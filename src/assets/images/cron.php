<?php
$command = '/usr/bin/php /httdocs/yii mailqueue/process';
$output = array();
$return_var = 0;
exec($command, $output, $return_var);

file_put_contents('/httdocs/cron_log.txt', date('Y-m-d H:i:s') . "\n", FILE_APPEND);
file_put_contents('/httdocs/cron_log.txt', "Command: $command\n", FILE_APPEND);
file_put_contents('/httdocs/cron_log.txt', "Return: $return_var\n", FILE_APPEND);
file_put_contents('/httdocs/cron_log.txt', "Output: " . print_r($output, true) . "\n\n", FILE_APPEND);