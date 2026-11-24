<?php
declare(strict_types=1);
// Hostinger PHP backend. Documents and SQLite data live OUTSIDE public_html.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
const PHOTO_KINDS = ['portrait', 'pan', 'aadhaar_front', 'aadhaar_back'];
const REQUIRED_PHOTOS = ['portrait', 'pan', 'aadhaar_front', 'aadhaar_back'];
function respond(array $body, int $status = 200): never {
    http_response_code($status); echo json_encode($body, JSON_THROW_ON_ERROR); exit;
}
function reject(string $message, int $status = 400): never { respond(['error' => $message], $status); }
function origin_check(): void {
    $expected = 'https://' . ($_SERVER['HTTP_HOST'] ?? '');
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== $expected) reject('Please submit from the wedding page.', 403);
}
function begin_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('witness_organiser');
    session_set_cookie_params(['lifetime'=>0, 'path'=>'/', 'secure'=>true, 'httponly'=>true, 'samesite'=>'Strict']);
    session_start();
    if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function authenticated(): bool {
    begin_session(); return !empty($_SESSION['organiser']) && ($_SESSION['expires'] ?? 0) > time();
}
function csrf_check(): void {
    origin_check(); begin_session();
    if (!hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) reject('Please refresh the organiser page and try again.', 403);
}
function body_json(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 8192) reject('Request too large.', 413);
    try { $body = json_decode(file_get_contents('php://input'), true, 16, JSON_THROW_ON_ERROR); }
    catch (Throwable $e) { reject('Invalid request.'); }
    if (!is_array($body)) reject('Invalid request.'); return $body;
}
function current_places(PDO $db): array {
    $slots = array_map('intval', $db->query("SELECT slot FROM witness_requests WHERE status='verified'")->fetchAll(PDO::FETCH_COLUMN));
    return ['booked'=>count($slots), 'open'=>4-count($slots), 'slots'=>array_map(fn($n)=>['number'=>$n,'booked'=>in_array($n,$slots,true)], [1,2,3,4])];
}
function request_id(string $value): bool { return (bool)preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', $value); }
function row(PDO $db, string $sql, array $args=[]): array|false { $q=$db->prepare($sql); $q->execute($args); return $q->fetch(PDO::FETCH_ASSOC); }
function photo_path(string $private, string $id, string $kind): string { return $private . '/photos/' . $id . '_' . $kind; }
function has_documents(string $private, string $id): bool {
    foreach (PHOTO_KINDS as $kind) if (is_file(photo_path($private, $id, $kind))) return true;
    return false;
}

try {
    $configPath = getenv('WITNESS_CONFIG') ?: dirname(__DIR__, 2) . '/witness-private/config.php';
    if (!is_file($configPath)) reject('Registration is being set up. Please try again shortly.', 503);
    $config = require $configPath;
    $private = $config['storage_dir'];
    $db = new PDO('sqlite:' . $private . '/witnesses.sqlite', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA busy_timeout=5000');
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $path = preg_replace('#^/public(?=/)#', '', $path);
    $method = $_SERVER['REQUEST_METHOD'];
    if ($path === '/api/availability' && $method === 'GET') respond(current_places($db));
    if ($path === '/api/witnesses' && $method === 'POST') {
        origin_check();
        if ((int)($_SERVER['CONTENT_LENGTH']??0)>13000000) reject('The photos are too large. Please choose smaller photos.',413);
        $data=$_POST;
        if (!is_string($data['submissionId']??null) || !is_string($data['fullName']??null)) reject('Please enter your name.');
        $id=$data['submissionId']; $name=trim($data['fullName']);
        if (!request_id($id)) reject('Please refresh the form and try again.');
        if (preg_match('/[\x00-\x1f\x7f]/',$name) || !preg_match('/^.{2,80}$/us',$name)) reject('Please enter your name (2–80 characters).');
        $name=preg_replace('/\s+/u',' ',$name);
        if (($data['consent']??'')!=='yes') reject('Please agree to share your photos with the organiser.');
        if (($data['reviewed']??'')!=='yes') reject('Please review and confirm all four photos before submitting.');
        $old=row($db,'SELECT id,full_name FROM witness_requests WHERE id=?',[$id]);
        if ($old) { if($old['full_name']!==$name) reject('Please refresh the form.',409);respond(['success'=>true,'reference'=>strtoupper(substr($id,0,8))]); }
        $files=[];
        foreach (REQUIRED_PHOTOS as $kind) {
            $file=$_FILES[$kind]??null;
            if (!$file || !is_array($file) || !is_string($file['tmp_name']??null) || ($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) reject('Your photo, PAN, Aadhaar front and Aadhaar back are all required.');
            if (!$file['size'] || $file['size']>3000000) reject('Each photo must be under 3 MB.',413);
            $info=@getimagesize($file['tmp_name']);
            if (!$info || !in_array($info[2],[IMAGETYPE_JPEG,IMAGETYPE_PNG,IMAGETYPE_WEBP],true)) reject('Use a valid JPG, PNG or WebP photo.');
            if (min($info[0],$info[1])<160 || max($info[0],$info[1])>8000) reject('Please use a clear photo between 160 and 8000 pixels.');
            $files[$kind]=$file['tmp_name'];
        }
        if (hash_file('sha256',$files['aadhaar_front'])===hash_file('sha256',$files['aadhaar_back'])) reject('Aadhaar front and back must be different photos.');
        $stored=[];
        $db->exec('BEGIN IMMEDIATE');
        try {
            $old=row($db,'SELECT id,full_name FROM witness_requests WHERE id=?',[$id]);
            if ($old) { $db->exec('ROLLBACK'); if($old['full_name']!==$name) reject('Please refresh the form.',409);respond(['success'=>true,'reference'=>strtoupper(substr($id,0,8))]); }
            if (row($db,"SELECT id FROM witness_requests WHERE full_name=? COLLATE NOCASE AND status IN ('pending','verified')",[$name])) { $db->exec('ROLLBACK'); reject('Your name is already with the organiser.',409); }
            if (current_places($db)['open']===0) { $db->exec('ROLLBACK'); reject('All four witness places are booked.',409); }
            if ((int)$db->query("SELECT COUNT(*) FROM witness_requests WHERE status='pending'")->fetchColumn()>=12) { $db->exec('ROLLBACK'); reject('Registration is temporarily full. Please contact the organiser.',409); }
            $now=gmdate('c');
            $q=$db->prepare('INSERT INTO witness_requests (id,full_name,phone,active_phone,relationship,consent_at,created_at) VALUES (?,?,?,?,?,?,?)');
            // Keep the existing schema and any earlier submissions intact.
            $q->execute([$id,$name,'',null,'',$now,$now]);
            foreach ($files as $kind=>$temporary) {
                $destination=photo_path($private,$id,$kind);
                if (!move_uploaded_file($temporary,$destination)) throw new RuntimeException('Storage failed');
                $stored[]=$destination;
                if (!chmod($destination,0600)) throw new RuntimeException('Private file permissions failed');
            }
            $db->exec('COMMIT');
        } catch (Throwable $e) {
            try {$db->exec('ROLLBACK');} catch(Throwable $ignored) {}
            foreach ($stored as $file) if(is_file($file)) @unlink($file);
            throw $e;
        }
        respond(['success'=>true,'reference'=>strtoupper(substr($id,0,8))],201);
    }
    if (str_starts_with($path,'/api/admin/')) {
        begin_session();
        if ($path==='/api/admin/session' && $method==='GET') respond(['authenticated'=>authenticated(),'csrf'=>$_SESSION['csrf']]);
        if ($path==='/api/admin/login' && $method==='POST') {
            csrf_check(); $data=body_json();
            $ip=hash_hmac('sha256',$_SERVER['REMOTE_ADDR']??'unknown',$config['rate_salt']);
            $window=(int)floor(time()/900);
            $attempt=row($db,'SELECT attempts FROM admin_login_limits WHERE key=? AND window=?',[$ip,$window]);
            if (($attempt['attempts']??0)>=10) reject('Too many attempts. Try again in 15 minutes.',429);
            if (!password_verify((string)($data['password']??''),$config['admin_hash'])) {
                $q=$db->prepare('INSERT INTO admin_login_limits (key,window,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window=excluded.window THEN attempts+1 ELSE 1 END, window=excluded.window');$q->execute([$ip,$window]);
                reject('The organiser password is incorrect.',403);
            }
            session_regenerate_id(true);$_SESSION['organiser']=true;$_SESSION['expires']=time()+28800;$_SESSION['csrf']=bin2hex(random_bytes(32));
            respond(['authenticated'=>true,'csrf'=>$_SESSION['csrf']]);
        }
        if (!authenticated()) reject('Organiser sign-in required.',403);
        if ($path==='/api/admin/logout' && $method==='POST') {csrf_check();$_SESSION=[];session_destroy();respond(['success'=>true]);}
        if ($path==='/api/admin/requests' && $method==='GET') {
            $requests=$db->query('SELECT id,full_name,phone,relationship,status,slot,created_at,reviewed_at FROM witness_requests ORDER BY created_at DESC')->fetchAll();
            foreach ($requests as &$request) {
                $request['documents']=array_values(array_filter(PHOTO_KINDS,fn($kind)=>is_file(photo_path($private,$request['id'],$kind))));
                $request['has_documents']=(bool)$request['documents'];
            }
            unset($request);
            respond(['requests'=>$requests,'availability'=>current_places($db)]);
        }
        if (preg_match('#^/api/admin/document/([^/]+)/([^/]+)$#',$path,$m) && $method==='GET') {
            if (!request_id($m[1]) || !in_array($m[2],PHOTO_KINDS,true) || !row($db,'SELECT id FROM witness_requests WHERE id=?',[$m[1]])) reject('Photo not found.',404);
            $file=photo_path($private,$m[1],$m[2]);if(!is_file($file))reject('Photo not found.',404);
            $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file);
            header('Content-Type: '.$mime);header('Cross-Origin-Resource-Policy: same-origin');header('Content-Disposition: inline; filename="'.$m[2].'.jpg"');readfile($file);exit;
        }
        if (preg_match('#^/api/admin/requests/([^/]+)$#',$path,$m) && $method==='POST' && request_id($m[1])) {
            csrf_check();$data=body_json();$id=$m[1];$action=$data['action']??'';
            $db->exec('BEGIN IMMEDIATE');
            try {
                $item=row($db,'SELECT * FROM witness_requests WHERE id=?',[$id]);
                if (!$item) {$db->exec('ROLLBACK');reject('Submission not found.',404);}
                if ($action==='verify') {
                    $photosRequired=has_documents($private,$id);
                    if (($data['identityChecked']??false)!==true || ($data['attendanceChecked']??false)!==true || ($photosRequired && ($data['photosChecked']??false)!==true)) {$db->exec('ROLLBACK');reject('Complete the organiser review checks.');}
                    $places=current_places($db);$open=array_values(array_filter($places['slots'],fn($slot)=>!$slot['booked']));
                    if (!$open || $item['status']!=='pending') {$db->exec('ROLLBACK');reject('No open place is available, or this submission is already reviewed.',409);}
                    $q=$db->prepare("UPDATE witness_requests SET status='verified',slot=?,reviewed_at=? WHERE id=?");$q->execute([$open[0]['number'],gmdate('c'),$id]);
                } elseif ($action==='reject') {
                    $q=$db->prepare("UPDATE witness_requests SET status='rejected',slot=NULL,active_phone=NULL,reviewed_at=? WHERE id=?");$q->execute([gmdate('c'),$id]);
                } elseif ($action==='delete') {
                    foreach (PHOTO_KINDS as $kind) { $file=photo_path($private,$id,$kind); if(is_file($file) && !unlink($file)) throw new RuntimeException('Delete failed'); }
                    $q=$db->prepare('DELETE FROM witness_requests WHERE id=?');$q->execute([$id]);
                } else {$db->exec('ROLLBACK');reject('Unknown review action.');}
                $db->exec('COMMIT');respond(['success'=>true]);
            } catch(Throwable $e) {try{$db->exec('ROLLBACK');}catch(Throwable $ignored){}throw $e;}
        }
    }
    reject('Not found.',404);
} catch(Throwable $error) {
    error_log('Witness request failed: '.get_class($error));
    reject('Something went wrong. Please try again shortly.',500);
}
