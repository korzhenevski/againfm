#!/bin/bash

CURRENT_DIR="$(cd "$( dirname "$0" )" && pwd)"
ssh -i $CURRENT_DIR/id_rsa $*