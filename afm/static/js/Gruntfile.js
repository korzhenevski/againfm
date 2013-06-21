module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            options: {
                separator: ';'
            },
            core: {
                src: ['core/angular.js', 'core/*.js', 'base.js', 'user.js'],
                dest: 'tmp/dist/core.full.js'
            },
            player: {
                src: [
                    'common/swfobject.js',
                    'common/comet.js',
                    'common/ui-transition.js',
                    'common/ui-animate.js',
                    'sound.js',
                    'player.js'
                ],
                dest: 'tmp/dist/player.full.js'
            }
        },

        ngmin: {
            core: {
                src: 'tmp/dist/core.full.js',
                dest: 'tmp/dist/core.ngmin.js'
            },

            player: {
                src: 'tmp/dist/player.full.js',
                dest: 'tmp/dist/player.ngmin.js'
            }
        },


        uglify: {
            options: {
                mangle: false,
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
            },
            core: {
                files: {'dist/core.js': ['tmp/dist/core.ngmin.js']}
            },
            player: {
                files: {'dist/player.js': ['tmp/dist/player.ngmin.js']}
            }
        },

        clean: ['tmp']
    });

    grunt.loadNpmTasks('grunt-ngmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-clean');

    grunt.registerTask('default', ['concat', 'ngmin', 'uglify', 'clean']);
};