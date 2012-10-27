# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant::Config.run do |config|
    config.vm.box = "base"
    config.vm.box_url = "http://files.vagrantup.com/precise64.box"
    config.vm.network :hostonly, "10.0.0.2"

    config.nfs.map_uid = Process.uid
    config.nfs.map_gid = Process.gid

    config.vm.share_folder "v-app", "/var/www/againfm", ".", :create => true, :nfs => true
    config.vm.customize ["modifyvm", :id, "--memory", 512]
    config.vm.provision :chef_solo do |chef|
        chef.cookbooks_path = "./vendor/cookbooks"
        chef.add_role 'dev'

        chef.add_recipe "timezone"
        chef.add_recipe "ark"
        chef.add_recipe "build-essential"
        chef.add_recipe "apt"
        chef.add_recipe "vim"
        chef.add_recipe "git"
        chef.add_recipe "python"
        chef.add_recipe "nginx"
        chef.add_recipe "redis::server"
        chef.add_recipe "mongodb::10gen_repo"
        chef.add_recipe "mongodb::default"
        #chef.add_recipe "mongodb::replicaset"
        chef.add_recipe "againfm"

        File.open(File.expand_path("../chef.json", __FILE__)) do |f|
            chef.json.merge!(JSON.parse(f.read))
        end
    end
end
