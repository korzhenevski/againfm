#!/usr/bin/env python
# -*- coding: utf-8 -*-

from fabric.api import env, local, run, lcd, cd, sudo
from fabric.contrib.files import exists

env.project = '/var/www/againfm'
env.current = env.project + '/current'
env.releases = env.project + '/releases'

"""
починить рестарт редиса
починить старт uwsgi
права на /var/www/againfm
(Permission denied: '/var/www/againfm/afm/static/.webassets-cache')
virtualenv и поддержка откатов
"""

def vagrant():
    # change from the default user to 'vagrant'
    env.user = 'vagrant'
    # connect to the port-forwarded ssh
    env.hosts = ['10.0.0.2']
 
    # use vagrant ssh key
    result = local('vagrant ssh-config | grep IdentityFile', capture=True)
    env.key_filename = result.split()[1]
 
def init():
	run('pip install -r {}/requirements.txt'.format(env.project))

def compass():
    local('compass watch afm/static')

def celery():
    local('celery -A afm.celery worker -l info')

def player():
    with lcd('player'):
        local('as3compile --flashversion 10 --output ../afm/static/swf/player.swf player.as')

def handlebars():
    with lcd('afm/static/js'):
        local('handlebars templates/*.handlebars --min --output render.js')

def install_chef():
    sudo('aptitude update')
    core_packages = 'git-core vim-nox ruby1.9.1 ruby1.9.1-dev build-essential libevent-dev'
    python_packages = 'python python-dev python-pip python-virtualenv'
    sudo('aptitude install -y {} {}'.format(core_packages, python_packages))
    sudo('gem install chef --no-ri --no-rdoc')

def release_list():
    print sudo('ls -1 {} | sort -n | tail -n1'.format(env.releases))

def deploy(rev=None):
    from datetime import datetime

    # деплой конкретной ревизии или откат на предыдущую
    if rev:
        if rev == 'rollback':
            rev = sudo('ls -1 {} | sort -n | tail -n1'.format(env.releases)).strip()
        release_path = env.releases + '/' + rev
    else:
        repo = 'https://github.com/outself/againfm.git'
        tmp = '/tmp/againfm-deploy'
        if exists(tmp):
            sudo('rm -rf {}'.format(tmp))

        sudo('git clone {} {}'.format(repo, tmp))
        #with cd(tmp):
        #    sudo('virtualenv venv')
        #    sudo('./venv/bin/pip install -r requirements.txt')

        # публикуем релиз
        release = datetime.now().strftime('%Y%m%d%H%M%S')
        release_path = env.releases + '/' + release
        sudo('mv {} {}'.format(tmp, release_path))

    # обновляем
    if exists(env.current):
        sudo('rm -rf {}'.format(env.current))
    sudo('ln -s {} {}'.format(release_path, env.current))

    # обновляем шеф-рецепты :)
    chef = env.current + '/chef'
    sudo('chef-solo -c {chef}/solo.rb -j {chef}/production.json'.format(chef=chef))