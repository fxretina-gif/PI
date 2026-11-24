<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') {http_response_code(404);exit;}
$private=$argv[1]??'';
if (!$private || !str_starts_with($private,'/')) throw new RuntimeException('Absolute private storage directory required.');
if (!is_dir($private)) mkdir($private,0700,true);
if (!is_dir($private.'/photos')) mkdir($private.'/photos',0700,true);
if (!is_file($private.'/config.php')) {
    $input=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);
    if (strlen($input['password']??'')<20) throw new RuntimeException('Strong initial password required.');
    $config=['storage_dir'=>$private,'admin_hash'=>password_hash($input['password'],PASSWORD_DEFAULT),'rate_salt'=>bin2hex(random_bytes(32))];
    file_put_contents($private.'/config.php',"<?php\nreturn ".var_export($config,true).";\n");chmod($private.'/config.php',0600);
    echo "ADMIN_CREATED\n";
} else echo "ADMIN_ALREADY_CONFIGURED\n";
$db=new PDO('sqlite:'.$private.'/witnesses.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$db->exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY);');
foreach(glob(dirname(__DIR__).'/drizzle/*.sql') as $file) {
    $name=basename($file);$q=$db->prepare('SELECT name FROM _migrations WHERE name=?');$q->execute([$name]);
    if(!$q->fetchColumn()) {$db->beginTransaction();try{$db->exec(file_get_contents($file));$q=$db->prepare('INSERT INTO _migrations VALUES (?)');$q->execute([$name]);$db->commit();}catch(Throwable $e){$db->rollBack();throw $e;}}
}
chmod($private.'/witnesses.sqlite',0600);echo "DATABASE_READY\n";
