set :spinner_user, nil #weird hack
set :stages, %w(staging production)
require 'capistrano/ext/multistage'
require 'capistrano/ext/monitor'
require "bundler/capistrano"
#require 'capistrano/gitflow'
ssh_options[:keys] = [File.join("config", "deploy", "ssh", "id-vizzuality.pem")]

