/**
 * player - [...] - значения которые обновляются переодический
 * рисовалка значений
 *
 * @type {*}
 */


App.RadioSpectrum = App.View.extend({
    el: '#spectrum',
    limit: 300,
    colors: ['#d86b26', '#d72f2e', '#0f9ac5'],
    running: false,

    initialize: function(options) {
        this.player = options.player;
        this.player.on('playing', this.start, this);
        this.player.on('stopped', this.stop, this);
        this.canvas = this.el.getContext('2d');
        _.bindAll(this, 'pullSpectrum', 'animate', '_updateDimensions', 'drawBlankLine');
        $(window).resize(_.throttle(this._updateDimensions, 200));
        this._updateDimensions();
    },

    _updateDimensions: function() {
        this.width = this.$el.width();
        this.height = this.$el.height();
        this.lineSize = Math.floor(this.limit / this.colors.length);
        this.renderStep = Math.round(this.width / this.lineSize);
    },

    start: function() {
        this.running = true;
        this.spectrum = [];
        this.points = [];
        this.animateTime = 0;
        this.spectrumTime = 0;
        for (var i = 0; i < this.limit; ++i) {
            this.points[i] = 10;
        }
        var self = this;
        _.delay(function(){
            //this.drawBlankLine();
            self.animate2();
        }, 1000);
    },

    stop: function() {
        this.running = false;
        this.clear();
        this.drawBlankLine();
    },

    drawBlankLine: function() {
        this.clear();
        var ctx = this.canvas,
            color = '#f3f3f3',
            height = 68;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 2;

        ctx.moveTo(0, height);
        ctx.lineTo(this.width, height);
        ctx.stroke();
    },

    render: function() {
        this.clear();
        for(var lineIndex = 0; lineIndex < this.colors.length; lineIndex++) {
            var pos = 0,
                points = [],
                lim = (lineIndex + 1) * this.lineSize;
            var maxVal = this.height - 5;
            var c = 0;
            for (var i = lineIndex * this.lineSize; i < lim; i++) {
                var val = (this.points[i] + 10 * lineIndex);
                if (val > maxVal) {
                    val = maxVal;
                }
                if (val < 0) {
                    val = 5;
                }
                points.push([pos, val]);
                pos += this.renderStep;
                c++;
            }

            this.drawCurve(points, this.colors[lineIndex]);
        }
    },

    /**
     * 1. exists
     *
     * to = from
     * from = getSpectrum
     *
     * 2. not exists
     *
     * to = getSpectrum
     * from = zero fill
     *
     *
     *
     */

    animate2: function() {
        var duration = 450;
        var interval = 25;
        var steps = duration / interval;
        var pointer = 0;
        var stepped;
        var step, from, to;
        var self = this;
        function computeStep() {
            if (from && to) {
                to = from;
                from = self.pullSpectrum();
            } else {
                from = [];
                for(var i = 0; i < self.limit; i++) {
                    from.push(0);
                }
                to = self.pullSpectrum();
            }
            step = [];
            stepped = steps;
            for (var i = 0; i < from.length; i++) {
                var val = (to[i] - from[i]);
                if (val != 0) {
                    val = val / steps;
                }
                step[i] = val;
            }
            pointer++;
            //if (pointer > 10) {
            //    return false;
            //}
            return true;
        }
        function stepper(){
            if (!step) {
                return false;
            }
            var current = [];
            for (var i = 0; i < from.length; i++) {
                from[i] = from[i] + step[i];
                current[i] = parseFloat(from[i].toFixed(2));
            }
            self.points = current;
            self.render();
            //console.log(current);
            if (--stepped) {
                setTimeout(stepper, interval);
            } else {
                if (computeStep()) {
                    setTimeout(stepper, interval);
                }
            }
        }
        computeStep();
        stepper();
    },

    animate: function() {
        var size = this.spectrum.length;
        if (!size) {
            this.pullSpectrum();
        }

        var change = this.animateTime ? ((new Date()) - this.animateTime) : 0;
        if (!change || change > 70) {
            this.animateTime = +new Date();

            for (var i = 0; i < size; i++) {
                var diff = this.spectrum[i] - this.points[i];
                if (diff != 0) {
                    var val = this.points[i] + (diff * (change / 1000));
                    if (val >= this.spectrum[i]) {
                        val = this.spectrum[i];
                    }
                    this.points[i] = val;
                }
            }
            this.render();
        }

        if (this.running) {
            requestAnimFrame(this.animate);
        }
    },

    drawCurve: function(points, color) {
        var factor = 0.4,
            linewidth = 1,
            ctx = this.canvas;
        ctx.beginPath();

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 3;

        ctx.strokeStyle = color;
        ctx.lineWidth = linewidth;
        var len = points.length;

        for (var i = 0; i < len; ++i) {
            if (points[i] && typeof(points[i][1]) == 'number' && points[i + 1] && typeof(points[i + 1][1]) == 'number') {
                var coordX = points[i][0];
                var coordY = points[i][1];
                var nextX = points[i + 1][0];
                var nextY = points[i + 1][1];
                var prevX = points[i - 1] ? points[i - 1][0] : null;
                var prevY = points[i - 1] ? points[i - 1][1] : null;
                var offsetX = (points[i + 1][0] - points[i][0]) * factor;
                var offsetY = (points[i + 1][1] - points[i][1]) * factor;

                if (i == 0) {
                    ctx.moveTo(coordX, coordY);
                    ctx.lineTo(nextX - offsetX, nextY - offsetY);
                } else if (nextY == null) {
                    ctx.lineTo(coordX, coordY);
                } else if (prevY == null) {
                    ctx.moveTo(coordX, coordY);
                } else if (coordY == null) {
                    ctx.moveTo(nextX, nextY);
                } else {
                    ctx.quadraticCurveTo(coordX, coordY, coordX + offsetX, coordY + offsetY);
                    if (nextY) {
                        ctx.lineTo(nextX - offsetX, nextY - offsetY);
                    } else {
                        ctx.lineTo(coordX, coordY);
                    }
                }
            } else if (typeof(points[i][1]) == 'number') {
                ctx.lineTo(points[i][0], points[i][1]);
            }
        }
        ctx.stroke();
    },

    pullSpectrum: function() {
        return this.player.engine.getSpectrum(this.limit);
    },

    clear: function() {
        this.canvas.clearRect(0, 0, this.width, this.height);
    }
});
