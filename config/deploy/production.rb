# node deploy config

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


# not needed if using ssh agent forwarding as per: http://scie.nti.st/2007/10/12/minimal-footprint-ssh-agent-forwarding-on-os-x

# ensures ssh-agent is always running
after "deploy:setup", "deploy:setup_deploy_keys"
namespace :deploy do
  desc "restart server"
  task :setup_deploy_keys do
    run "echo 'eval `ssh-agent`' >> ~/.bashrc"
    # top.upload "config/deploy/ssh/deploy_key.pem", "/home/ubuntu/.ssh/", :via => :scp
    # top.upload "config/deploy/ssh/deploy_key.pub", "/home/ubuntu/.ssh/", :via => :scp
    # run "chmod 600 /home/ubuntu/.ssh/deploy_key.*"
    # run "eval `ssh-agent` && ssh-add /home/ubuntu/.ssh/deploy_key.pem" do |ch, stream, out|
    #   logger.info(out);
    #   ch.send_data "password\n" if out =~ /.*deploy_key.pem/
    # end  
  end
end  
