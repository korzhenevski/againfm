from . import app
from flask import render_template

@app.route('/')
def show():
    return render_template('index.html')