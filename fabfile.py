#!/usr/bin/env python
# -*- coding: utf-8 -*-

from datetime import datetime
from fabric.api import env, local, run, lcd, cd, sudo, settings
from fabric.contrib.files import exists
from fabric.contrib.console import confirm

env.project = '/var/www/againfm'
env.project_current = env.project + '/current'
env.project_releases = env.project + '/releases'

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

def bootstrap(force=False):
    if exists(env.project) and not force:
        return
    sudo('mkdir -p {}'.format(env.project))
    sudo('mkdir -p {}'.format(env.project_releases))
    sudo('aptitude update')
    core_packages = 'git-core vim-nox ruby1.9.1 ruby1.9.1-dev build-essential libevent-dev curl'
    python_packages = 'python python-dev python-pip python-virtualenv'
    sudo('aptitude install -y {} {}'.format(core_packages, python_packages))
    sudo('gem install chef --no-ri --no-rdoc')

def deploy(rev=None):
    bootstrap()

    # деплой конкретной ревизии или откат на предыдущую
    if rev:
        if rev == 'rollback':
            rev = sudo('ls -1 {} | sort -n | tail -n1'.format(env.project_releases)).strip()
        release_path = env.project_releases + '/' + rev
    else:
        repo = 'https://github.com/outself/againfm.git'
        tmp = '/tmp/againfm-deploy'
        with settings(warn_only=True):
            sudo('rm -rf {}'.format(tmp))
        sudo('git clone {} {}'.format(repo, tmp))

        # публикуем релиз
        release = datetime.now().strftime('%Y%m%d%H%M%S')
        release_path = env.project_releases + '/' + release
        sudo('mv {} {}'.format(tmp, release_path))

        if confirm('Update VirtualEnv?'):
            # установка пакетов до линковки
            venv(release_path)

    # линкуем релиз в current
    if exists(env.project_current):
        sudo('rm -rf {}'.format(env.project_current))
    sudo('ln -s {} {}'.format(release_path, env.project_current))

    # обновляем шеф-рецепты :)
    chef = env.project_current + '/chef'
    sudo('chef-solo -c {chef}/solo.rb -j {chef}/production.json'.format(chef=chef))

def venv(release_path=None):
    if release_path is None:
        release_path = sudo('readlink {}'.format(env.project_current))
    with cd(release_path):
        with settings(warn_only=True):
            sudo('rm -rf venv')
        sudo('virtualenv venv')
        sudo('./venv/bin/pip install --download-cache /tmp/pip-cache -r requirements.txt')

def revlist():
    print sudo('ls -1 {} | sort -n'.format(env.project_releases))