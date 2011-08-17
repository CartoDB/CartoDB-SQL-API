# node deploy config

# first time deploy:
# cap production deploy:setup
# cap production deploy
# cap production node:npm_dependencies
# cap production deploy:restart



# somehow we'll have to update this dynamically
set :host_1, "shared01.cartodb.com" #{}"laneveraroja.cartodb.com" #"50.16.114.42" #"174.129.61.69"
role :app, host_1

ssh_options[:forward_agent] = true

# repository
set :application, "node-sql-api"
set :repository, "git@github.com:Vizzuality/CartoDB-SQL-API.git"
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
before 'deploy:setup', 'deploy:create_deploy_to_with_sudo'
after  "deploy:setup", "deploy:setup_deploy_keys"
after  "deploy:setup", "deploy:setup_node_directories"
after  'deploy:setup', 'deploy:write_upstart_script'

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
    
  task :start, :roles => :app, :except => { :no_release => true } do
    sudo "start #{application}"
  end

  task :stop, :roles => :app, :except => { :no_release => true } do
    sudo "stop #{application}"
  end

  task :restart, :roles => :app, :except => { :no_release => true } do
    #sudo "stop #{application}"
    sudo "start #{application}"
  end

  task :create_deploy_to_with_sudo, :roles => :app do
    sudo "mkdir -p #{deploy_to}"
    sudo "chown #{user}:#{user} #{deploy_to}"
  end

  # creates daemon to manage node. Also respawns if dies  
  task :write_upstart_script, :roles => :app do
    upstart_script = <<-UPSTART
      description "#{application}"

      start on startup
      stop on shutdown

      script
          # We found $HOME is needed. Without it, we ran into problems
          export HOME="/home/#{user}"

          cd #{current_path}
          exec sudo -u #{user} sh -c "/home/ubuntu/local/node/bin/node #{current_path}/#{node_file} production >> #{shared_path}/logs/#{application}.log 2>&1"
      end script
      respawn
    UPSTART
    
    put upstart_script, "/tmp/#{application}_upstart.conf"
    sudo "mv /tmp/#{application}_upstart.conf /etc/init/#{application}.conf"
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
    run "rm -rf #{current_path}/node_modules"
    run "cd #{current_path} && npm install"
    run "mv -f #{current_path}/node_modules #{shared_path}/node_modules"
    run "ln -s #{shared_path}/node_modules #{current_path}/node_modules"
  end  
  
  desc "update dependencies"
  task :update_dependencies, :roles => :app do
    run "cd #{current_path} && npm install"
  end  
end