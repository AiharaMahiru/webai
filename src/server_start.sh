PATH=/www/server/nodejs/v22.14.0/bin:/bin:/sbin:/usr/bin:/usr/sbin:/usr/local/bin:/usr/local/sbin:~/bin
export PATH

export 
export NODE_PROJECT_NAME="server"
cd /root/my-app/src
nohup /www/server/nodejs/v22.14.0/bin/node /root/my-app/src/server.js  &>> /www/wwwlogs/nodejs/server.log &
echo $! > /www/server/nodejs/vhost/pids/server.pid
