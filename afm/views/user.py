#!/usr/bin/env python
# -*- coding: utf-8 -*-

from flask import jsonify, render_template, url_for, session, redirect, request
from flask.ext.login import login_user, login_required, logout_user, current_user

from afm import app, db, login_manager
from afm.helpers import safe_input_field, safe_input_object, send_mail, get_email_provider

def permanent_login_user(user):
    """
    Логин пользователя с фиксацией сессии
    """
    login_user(user, remember=True)
    session.permanent = True

@login_manager.user_loader
def load_user(user_id):
    # проверка на активность в login_user
    return db.User.find_one({'id': user_id})

@login_manager.unauthorized_handler
def unauthorized():
    if request.is_xhr:
        return jsonify({'error': 'Auth required'}), 401
    return redirect(url_for('login'))

@app.context_processor
def app_context():
    return dict(standalone=request.is_xhr)

@app.route('/api/user/login', methods=['POST'])
def login():
    data = safe_input_object({'login': 'string', 'password': 'string'})
    data['login'] = data['login'].lower()
    user = db.User.find_login(data['login'])
    if user:
        direct_auth = user.check_password(data['password'])
        new_password_auth = user.confirm_new_password(data['password'])
        if direct_auth or new_password_auth:
            permanent_login_user(user)
            return jsonify({'user': user.get_public()})
        else:
            return jsonify({'error': 'auth'}), 401
    return jsonify({'error': 'no_user'}), 404


@app.route('/api/user/amnesia', methods=['POST'])
def amnesia():
    email = safe_input_field('email', 'string')
    email = email.lower()
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        auth_url = url_for('token_auth', user_id=user.id, token=token, _external=True)
        body = render_template('mail/amnesia.html', auth_url=auth_url, password=password)
        send_mail(email=user.email, body=body)
        return jsonify({'email_provider': get_email_provider(user.email)})
    return jsonify({'error': 'no_user'}), 404

@app.route('/api/user/signup', methods=['POST'])
def signup():
    data = safe_input_object({'email': 'string', 'password': 'string'})
    data['email'] = data['email'].lower()
    if db.User.find_one({'email': data['email']}):
        return jsonify({'error': 'email_exists'}), 409

    # create
    user = db.User()
    user.email = unicode(data['email'])
    user.set_password(data['password'])
    user.save()
    # login
    permanent_login_user(user)
    # send welcome email
    body = render_template('mail/signup.html')
    send_mail(email=user.email, body=body)
    return jsonify({'user': user.get_public()})

@app.route('/api/user/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'logout': True})

@app.route('/auth/token/<int:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.find_one({'id': user_id})
    if user and user.confirm_new_password(token):
        permanent_login_user(user)
    return redirect('/')