#!/bin/bash

CURRENT_DIR="$(cd "$( dirname "$0" )" && pwd)"
/usr/bin/ssh -o "StrictHostKeyChecking=no" -i $CURRENT_DIR/id_rsa $*