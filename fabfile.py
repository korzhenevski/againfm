from fabric.api import cd, local

def compass_watch():
    local('compass watch afm/static')

def celery():
    local('celery -A afm.celery worker -l info')