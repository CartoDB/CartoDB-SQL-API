# node deploy config

# somehow we'll have to update this dynamically
set :host_1, "174.129.61.69"
role :app, [host_1]

# repository
set :application, "node-sql-api"
set :repository, "git@github.com:tokumine/cartodb-sql-api.git"
set :scm, :git
#set :deploy_via, :remote_cache

# deploy settings
set :node_file, "cluster.js"
set :deploy_to, "/home/ubuntu/www/#{application}"
set :user, "ubuntu"
set :runner, "ubuntu"
set :use_sudo, true

default_run_options[:pty] = true

#after "deploy:update_code", "deploy:link_production_db"
#after "deploy:symlink", "deploy:update_crontab"
