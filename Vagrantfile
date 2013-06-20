# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant::Config.run do |config|
    config.vm.box = "base"
    config.vm.box_url = "http://files.vagrantup.com/precise64.box"
    config.vm.network :hostonly, "192.168.2.2"

    config.nfs.map_uid = Process.uid
    config.nfs.map_gid = Process.gid

    config.vm.share_folder "v-app", "/var/www/againfm", ".", :create => true, :nfs => true
    config.vm.customize ["modifyvm", :id, "--memory", 1024]
end
