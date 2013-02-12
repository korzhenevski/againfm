#!/usr/bin/env python
# -*- coding: utf-8 -*-

from datetime import datetime
from fabric.api import env, local, run, lcd, cd, sudo, settings, put, prefix
from fabric.contrib.files import exists, append, uncomment
from fabric.contrib.console import confirm

"""
быстрое обновление зависимостей с бекапом venv для легкого отката
сборка статики и жс-шаблонов
"""

def production():
    env.hosts = ['again.fm']
    env.user = 'root'
    env.chef_role = 'production'

def testing():
    env.hosts = ['testing.again.fm']
    env.user = 'root'
    env.chef_role = 'testing'

def againfm():
    env.project = '/var/www/againfm'
    env.project_current = env.project + '/current'
    env.project_releases = env.project + '/releases'
    env.repo = 'git@github.com:outself/againfm.git'
    env.gitssh = env.project + '/.ssh'

def playfm():
    env.project = '/var/www/playfm'
    env.project_current = env.project + '/current'
    env.project_releases = env.project + '/releases'
    env.repo = 'https://github.com/outself/playfm.git'
    env.gitssh = env.project + '/.ssh'

def vagrant():
    env.user = 'vagrant'
    env.hosts = ['10.0.0.2']
    result = local('vagrant ssh-config | grep IdentityFile', capture=True)
    env.key_filename = result.split()[1]

def dump():
    for collection in ['stations', 'streams', 'genres']:
        local('mongodump -d againfm -c {}'.format(collection))

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
        local('handlebars templates/*.handlebars --min --output libs/render.js')

def bootstrap(force=False):
    if exists(env.project) and not force:
        return
    sudo('mkdir -p {}'.format(env.project))
    sudo('mkdir -p {}'.format(env.project_releases))
    sudo('aptitude update')
    core_packages = 'git-core vim-nox ruby1.9.1 ruby1.9.1-dev build-essential libevent-dev libzmq-dev curl'
    python_packages = 'python python-dev python-pip python-virtualenv'
    sudo('aptitude install -y {} {}'.format(core_packages, python_packages))
    sudo('gem install chef --no-ri --no-rdoc')

def deploy(rev=None):
    bootstrap()

    # деплой конкретной ревизии или откат на предыдущую
    previous_rev = sudo('ls -1 {} | sort -n | tail -n1'.format(env.project_releases)).strip()
    if rev:
        if rev == 'rollback':
            rev = previous_rev
        release_path = env.project_releases + '/' + rev
    else:
        gitssh = env.gitssh + '/gitssh.sh'
        if not exists(env.gitssh):
            sudo('mkdir {}'.format(env.gitssh))
            put('etc/deploy/*', env.gitssh)
            sudo('chmod 600 {}/id_rsa'.format(env.gitssh))
            sudo('chmod +x {}'.format(gitssh))

        tmp = '/tmp/againfm-deploy'
        with settings(warn_only=True):
            sudo('rm -rf {}'.format(tmp))
        sudo('GIT_SSH="{}" git clone -b v2 {} {}'.format(gitssh, env.repo, tmp))

        # публикуем релиз
        release = datetime.now().strftime('%Y%m%d%H%M%S')
        release_path = env.project_releases + '/' + release
        sudo('mv {} {}'.format(tmp, release_path))

        if confirm('New VirtualEnv?'):
            # установка пакетов до линковки
            venv(release_path)
        else:
            sudo('cp -R {}/{}/venv {}/'.format(env.project_releases, previous_rev, release_path))
            if exists(release_path + '/requirements.txt'):
                with cd(release_path):
                    sudo('./venv/bin/pip install --download-cache /tmp/pip-cache -r requirements.txt')

    # линкуем релиз в current
    if exists(env.project_current):
        sudo('rm -rf {}'.format(env.project_current))
    sudo('ln -s {} {}'.format(release_path, env.project_current))
    provision()

def provision():
    # обновляем шеф-рецепты :)
    chef = env.project_current + '/chef'
    sudo('chef-solo -c {chef}/solo.rb -j {chef}/{role}.json'.format(chef=chef, role=env.chef_role))
    sudo('touch {}/restart.txt'.format(env.project_current))

def pull():
    with cd(env.project_current):
        sudo('GIT_SSH="{}" git pull'.format(env.gitssh + '/gitssh.sh'))

def venv(release_path=None):
    if release_path is None:
        release_path = sudo('readlink {}'.format(env.project_current))
    with cd(release_path):
        with settings(warn_only=True):
            sudo('rm -rf venv')
        sudo('virtualenv venv')
        if exists(release_path + '/requirements.txt'):
            sudo('./venv/bin/pip install --download-cache /tmp/pip-cache -r requirements.txt')

def rebuild_assets():
    with cd(env.project_current):
        sudo('./venv/bin/python manage.py assets build')

def revlist():
    sudo('ls -1 {} | sort -n'.format(env.project_releases))

def restart_service(services):
    for service in services.split(','):
        sudo('service {} restart'.format('service'))

def revclean():
    releases = sudo('ls -1 {} | sort -n'.format(env.project_releases)).split('\n')
    for release in releases:
        path = env.project_releases + '/' + release.strip()
        if not exists(path + '/venv'):
            sudo('rm -rf {}'.format(path))

def mongorestore():
    with cd(env.project_current):
        sudo('mongorestore')

def copy_ssh_id():
    import os
    if not exists('~/.ssh'):
        sudo('mkdir ~/.ssh')
    local_key = os.path.expanduser('~/.ssh/id_rsa.pub')
    append('~/.ssh/authorized_keys', open(local_key).read().strip(), use_sudo=True)
    sudo('cat ~/.ssh/authorized_keys')
