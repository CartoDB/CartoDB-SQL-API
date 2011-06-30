# node deploy config

# first time deploy:
# cap production deploy:setup
# cap production deploy
# cap production node:npm_dependencies
# cap production restart  #<-- not made yet



# somehow we'll have to update this dynamically
set :host_1, "174.129.61.69"
role :app, host_1

ssh_options[:forward_agent] = true

# repository
set :application, "node-sql-api"
set :repository, "git@github.com:tokumine/cartodb-sql-api.git"
set :scm, :git
set :deploy_via, :remote_cache

# deploy settings
set :node_file, "cluster.js"
set :deploy_to, "/home/ubuntu/www/#{application}"
set :user, "ubuntu"
set :runner, "ubuntu"
set :use_sudo, false

default_run_options[:pty] = true

after "deploy", "node:link_directories"

# ensures ssh-agent is always running
after "deploy:setup", "deploy:setup_deploy_keys"
after "deploy:setup", "deploy:setup_node_directories"

namespace :deploy do
  desc "setup ssh-agent"
  task :setup_deploy_keys do
    run "echo 'eval `ssh-agent`' >> ~/.bashrc"
  end
  
  desc "configure shared directory"
  task :setup_node_directories do
    run "mkdir -p #{shared_path}/logs"
    run "mkdir -p #{shared_path}/pids"
  end  
  
  desc "restart server"
  task :restart, :roles => :app, :except => { :no_release => true } do
    #run "touch #{File.join(current_path,'tmp','restart.txt')}"
  end
end  

namespace :node do
  desc "recreates symbolic links to shared directories"
  task :link_directories do
    run "rm #{current_path}/log"
    run "ln -s #{shared_path}/logs #{current_path}/logs"
    run "ln -s #{shared_path}/pids #{current_path}/pids"
    run "ln -s #{shared_path}/node_modules #{current_path}/node_modules"
  end
  
  desc "install dependencies"
  task :npm_dependencies, :roles => :app do
    run "cd #{current_path} && npm install"
    run "mv -f #{current_path}/node_modules #{shared_path}/node_modules"
    run "ln -s #{shared_path}/node_modules #{current_path}/node_modules"
  end  
end