// Global modifications

// Fisher-Yates shuffle
Array.prototype.shuffle = function() {
    var i = this.length;
    if ( i == 0 ) 
        return false;
    while ( --i ) {
        var j = Math.floor( Math.random() * ( i + 1 ) );
        var tmp = this[i];
        this[i] = this[j];
        this[j] = tmp;
    }
}

// Actual GA
var GA = (function($, canvas, status, controls){
    var self = {};
    self.ctx = null;
    
    // Maze obj constructor
    var Maze = function(start_x, start_y, end_x, end_y, rects, width, height, desc) {
        this.rects = rects;
        this.start_x = start_x;
        this.start_y = start_y;
        this.end_x = end_x;
        this.end_y = end_y;
        this.width = width;
        this.height = height;
        this.desc = desc;
    };
    Maze.prototype.setupBorderCoords = function() {
        // y - y1 = m(x-x1)
        this.start_edge_x = 0;
        this.start_edge_y = this.grad()*(- this.start_x) + this.start_y;

        // x = width
        this.end_edge_x = this.width;
        this.end_edge_y = this.grad()*(this.width - this.start_x) + this.start_y;
    }
    Maze.prototype.xParaFn = function(t){
        this.start_edge_x = 0;
        this.start_edge_y = this.grad()*(- this.start_x) + this.start_y;

        return (this.start_edge_x + t*(this.end_edge_x - this.start_edge_x)) 
    };
    Maze.prototype.yParaFn = function(t){ 
        this.end_edge_x = this.width;
        this.end_edge_y = this.grad()*(this.width - this.start_x) + this.start_y;

        return (this.start_edge_y + t*(this.end_edge_y - this.start_edge_y)) 
    };
    Maze.prototype.grad = function() {
        return ((this.end_y - this.start_y) / (this.end_x - this.start_x));
    };
    Maze.prototype.negGrad = function() {
        return -(1/this.grad());
    };
    Maze.prototype.draw = function(ctx) {
        ctx.fillStyle = "rgb(255,0,0)";
        ctx.fillRect(this.start_x - 5, this.start_y - 5,10,10);
        
        ctx.fillStyle = "rgb(0,0,255)";
        ctx.fillRect(this.end_x - 5, this.end_y - 5,10,10);
        
        ctx.fillStyle = "rgb(0,0,0)";
        var group, rect;
        for (var i =0 ; i < this.rects.length; i++) {
            group = this.rects[i];
            for (var j = 0; j < group.length; j++) {
                rect = group[j];
                ctx.fillRect(rect[0],rect[1],rect[2],rect[3]);
            }
        }
        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.strokeRect(0,0,this.width, this.height);
    };
    Maze.prototype.arePointsInFreeSpace = function(points) {
        // Make into array
        points = (typeof points.length != 'undefined') ? [points] : points;
        
        var group, rect, i,j,k;

        for (i = 0; i < this.rects.length; i++) {
            group = this.rects[i];
            for (j = 0; j < group.length; j++) {
                rect = group[j];
                
                for (k = 0; k < points.length; k++) {
                
                    if (this.isPointInRect(points[k])) {
                        return false;
                    }
                }
            }
        }
        return true;
    };
    Maze.prototype.isPointInRect = function(el, er, et, eb, p) {
        var x = p[0],
            y = p[1];
        return ((x > el) && (x < er)) && ((y > et) && (y < eb))
    };
    Maze.prototype.findCollisions = function(points, type) {
        // type = 0 : amount of intersection. Default.
        // type = 1 : number of collisions
        // type = 2 : amount of intersection IF the intersection amount if the path
        //            is cutting a corner, otherwise number of collisions
        var ret = 0;
        for (var cur = 0, next = 1; next < points.length; cur++, next++) {
            for (var j = 0; j < this.rects.length; j++) {
                var p1 = points[cur];
                var p2 = points[next];
                
                var group = this.rects[j];
                var rect;
                var hasCollidedWithGroup = false;
                
                for (var k = 0; k < group.length; k++) {
                    rect = group[k];

                    var el = rect[0],
                        et = rect[1],
                        er = rect[0] + rect[2],
                        eb = rect[1] + rect[3];

                    // Total up the percent of intersection
                    var percent = this.lineIntersectsRect(p1, p2, el, er, et, eb, true);

                    if (percent[0] > 0) {
                        // Either count intersections, or measure intersection
                        switch (type) {
                            case 1:
                                if (!hasCollidedWithGroup) {
                                    ret++;
                                    hasCollidedWithGroup = true;
                                }
                                break;
                            case 2:
                                //0 = L, 1 = R, 2 = B, 3 = T
                                var s1 = percent[1][0],
                                    s2 = percent[1][1];
                                // Valid diagonal combinations:
                                // LT, LB
                                // RT, RB
                                
                                // If it's a diagonal, and p1 and p2 in free space
                                if ((s1===0||s1==1) && (s2==2||s2==3) && this.arePointsInFreeSpace([p1,p2])){
                                    // fitness is the amount it's corner cutting
                                    ret += (percent[0] * d);
                                } else {
                                    // If not a diagonal, fitness has to be much worse
                                    ret += 1000;
                                }
                                break
                            default:
                                // Length between p1 and p2
                                var d = Math.sqrt(  Math.pow((p2[0] - p1[0]),2) + 
                                                    Math.pow((p2[1] - p1[1]),2));

                                // Total up the intersection
                                console.log('percent*d', (percent[0] * d));
                                ret += (percent[0] * d);
                                break;
                        }
                            
                    }
                }
            }
        }
        return ret;
    };
    // Liang-Barsky clipping
    // modified from: http://www.skytopia.com/project/articles/compsci/clipping.html
    Maze.prototype.lineIntersectsRect = function(p1,p2, el, er, eb, et, returnSides) {
        var dx = p2[0] - p1[0],
            dy = p2[1] - p1[1],
            t0 = 0.0, t1 = 1.0,
            p,q,r,sides=[];
        // if returnSides is set, return a 2-element array with the two sides
        // corresponding to which sides the path intersected at.

        for (var edge = 0; edge < 4; edge++) {
            if (edge===0) {  p = -dx;  q = -(el - p1[0]); }
            if (edge==1) {  p = dx;   q =  (er - p1[0]); }
            if (edge==2) {  p = -dy;  q = -(eb - p1[1]); }
            if (edge==3) {  p = dy;   q =  (et - p1[1]); }   
            r = q/p;
            if (p===0 && q<0) {
                return [0];   // Don't draw line at all. (parallel line outside)
            }

            if (p<0) {
                if (r>t1) {
                    return [0];         // Don't draw line at all.
                } else if (r>t0) {
                    t0=r;            // Line is clipped!
                    sides.push(edge);
                }
            } else if (p>0) {
                if (r<t0) {
                    return [0];      // Don't draw line at all.
                } else if (r<t1) {
                    t1=r;         // Line is clipped!
                    sides.push(edge);
                }
            }
        }

        // Return the percentage of this line that intersects,
        if (returnSides) {
            return [Math.abs(t1-t0), sides];
        } else {
            return [Math.abs(t1-t0)];
        }
    };
    
    self.updateProbs = function() {
        // decrease chance of random mttn, increase chance of small/flip
        if (self.mutateProbs.RANDOM + self.mutateProbs.FLIP +
            self.mutateProbs.SMALL < 1.0) {
            
            self.mutateProbs.RANDOM     *= 0.9995;
            self.mutateProbs.FLIP       *= 1.0005;
            self.mutateProbs.SMALL      *= 1.0005;
        }
    };
    
    // Initial Mutation probabilities
    self.mutateProbs = {
        SMALL : 0.05, 
        FLIP : 0.025, 
        RANDOM : 0.025
    };
    
    // Individual Path stuff
    var Path = function(angles) {

        this.path_angles = angles || this.generateAngles();
        this.points = [];
        this.col = '#' + Math.round(0xffffff * Math.random()).toString(16);
        this.start = [self.maze.start_x, self.maze.start_y];
        this.end = [self.maze.end_x, self.maze.end_y];

        // Constraints, in priority order:
        // is the path entirely inside
        this.contained = false;
        // Does the path not intersect with any obstacles
        this.feasible = true;

        this.mutateFns = {
            SMALL : this.smallMutation, 
            FLIP : this.flipMutation, 
            RANDOM :this.randomMutation
        };
        
        this.calcFitness();
    };
        
    // Find p3 given p1 and p2 and angle p1p3p2
    Path.prototype.findPointBetweenGivenAngle = function(p1, p2, angle) {
        var startEndAngle = rad2deg(Math.atan2(p2[0] - p1[0], p1[1] - p2[1]));

        // Length of line between p1 and p2, "baseline"
        var baseLength = Math.sqrt( Math.pow((p2[0] - p1[0]),2) + 
            Math.pow((p2[1] - p1[1]),2));

        // Angle relative from the baseline
        var relativeInsideAngle = (180 - angle)/2;

        // Length of p1 to p3
        var sideLength = Math.sin(deg2rad(relativeInsideAngle)) * 
            (baseLength/Math.sin(deg2rad(angle)));

        // Angle from North
        var angleFromNorth = startEndAngle - relativeInsideAngle;

        // Calculate p3
        var p3 = getPointAt(p1, sideLength, angleFromNorth);

        return p3;
    };
    
    // Recursively generate angles
    Path.prototype.generateAngles = function() {
        var nAngles = 20 + Math.floor(Math.random()*30);
        var start_end_points = [[self.maze.start_x, self.maze.start_y], [self.maze.end_x, self.maze.end_y]];
        
        var ret = null;
        while (!ret || (!ret.leftChild || !ret.rightChild)) {
            ret = this.generateAnglesHelper(start_end_points, nAngles);
        }
        return ret;
    };
    Path.prototype.generateAnglesHelper = function(points, nAngles) {
        var p1 = points[0];
        var p2 = points[1];
        
        var a_p3 = this.angleBetweenPoints(points);
        var angle = a_p3[0];
        var p3 = a_p3[1];
        
        // If no more angles needed, stop
        var tree = new BinaryTree(angle);
        
        // Split nAngles
        var anglesLeft = nAngles - 1; // as we just made one...
        var nLeftAngles = Math.round(Math.random() * anglesLeft);
        var nRightAngles = anglesLeft - nLeftAngles;
        if (nLeftAngles > 0) {
            tree.leftChild = this.generateAnglesHelper([p1,p3], nLeftAngles);
        }
        if (nRightAngles > 0) {
            tree.rightChild = this.generateAnglesHelper([p3,p2], nRightAngles);
        }
        return tree;
    };
    
    // Return a valid angle between points
    Path.prototype.angleBetweenPoints = function(points) {
        var p1 = points[0];
        var p2 = points[1];
        var p3, angle;
        
        // Find valid angle
        while (true) {
            angle = Math.floor(Math.random()*360);
            p3 = this.findPointBetweenGivenAngle(p1, p2, angle);
            
            // accept this angle?
            if (this.isValidPoint(p3)) {
                break;
            }
        }
        return [angle, p3];
    };
    
    // Is the arg a valid point
    Path.prototype.isValidPoint = function(p) {
        return ((p[0] > 0) && (p[0] < self.maze.width) && 
                (p[1] > 0) && (p[1] < self.maze.height));
    };
    Path.prototype.allPointsValid = function() {
        var ret = true;
        for (var i = 0; i < this.points.length; i++) {
            if (!this.isValidPoint(this.points[i])) {
                ret = false;
            }
        }
        return ret;
    };
    
    Path.prototype.calcPointsFromAngles = function() {
        var start_end_points = [[self.maze.start_x, self.maze.start_y], [self.maze.end_x, self.maze.end_y]];
        
        // Calculate teh angles, based on the root node
        var addedstuff = this.calcPointsFromAnglesHelper(this.path_angles, start_end_points);
        
        // Prefix start, suffix end
        var points = [start_end_points[0]];
        points = points.concat(addedstuff);
        points.push(start_end_points[1]);
        
        // Done
        this.points = points;
    };
    Path.prototype.calcPointsFromAnglesHelper = function(node, points) {
        var angle = node.data;
        
        var p1 = points[0];
        var p2 = points[1];
        var p3 = this.findPointBetweenGivenAngle(p1, p2, angle);
        
        // Recurse
        var left = node.leftChild ? this.calcPointsFromAnglesHelper(node.leftChild, [p1,p3]) : [];
        var right = node.rightChild ? this.calcPointsFromAnglesHelper(node.rightChild, [p3,p2]) : [];
        
        var added = [];
        added = added.concat(left);
        if (p3) {
            added.push(p3);
        }
        added = added.concat(right);
        return added;
    };
    
    Path.prototype.calcFitness = function() {
        if (!this.points.length) {
            this.calcPointsFromAngles();
        }
        var distance = 0;
        for (var cur = 0, next = 1; next < this.points.length; cur++, next++) {
            var curPoint = this.points[cur];
            var nextPoint = this.points[next];
            
            // distance
            distance += Math.sqrt( Math.pow((nextPoint[0] - curPoint[0]),2) + Math.pow((nextPoint[1] - curPoint[1]),2));
        }
        
        var collisions = self.maze.findCollisions(this.points, 1);

        if (this.allPointsValid()) {
            this.contained = true;
        } else {
            this.contained = false;
        }

        // If feasibile, fitness is length, if not feasible, fitness is intersections
        if (collisions) {
            this.feasible = false;
            this.fitness = -collisions;
        } else {
            this.feasible = true;
            this.fitness = -(1-Math.abs(1/distance)); // inverse to enable GT comparisons
        }
    };
    
    Path.prototype.draw = function(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = this.col;
        ctx.moveTo(this.points[0][0], this.points[0][1]);
        
        for (var i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i][0], this.points[i][1]);
        }
        ctx.stroke();
    };

    Path.prototype.crossoverWith = function(other) {
        // Main part: crossover the two angles
        var newAngles = this.path_angles.crossoverWith(other.path_angles);
        
        // Make the resulting path
        var c1 = new Path(newAngles[0]),
            c2 = new Path(newAngles[1]);
        return [c1,c2];
    };
    Path.prototype.mutate = function() {
        var p = Math.random();
        if (p <= self.mutateProbs.SMALL) {
            return this.mutateFns.SMALL.call(this); 
        }
        if (p <= (self.mutateProbs.FLIP + self.mutateProbs.SMALL)) { 
            return this.mutateFns.FLIP.call(this); 
        }
        if (p <= (self.mutateProbs.RANDOM + self.mutateProbs.FLIP + self.mutateProbs.SMALL)) { 
            return this.mutateFns.RANDOM.call(this); 
        }
        
        return this;
    };
    
    Path.prototype.smallMutation = function () {
        var p = 1/ this.path_angles.size();
        var newAngles = this.path_angles.clone();
        var ret = null;
        newAngles.preorderTraverse(function(node) {
            var prob = Math.random();
            if (prob < p) {
                var change;

                while (true) {
                    // change between -15 and +15
                    change = -15 + Math.floor(Math.random()*30);

                    // disallow changing the angle to 0
                    if ((node.data + change) % 360 !== 0) {
                        break;
                    }
                }
                node.data += change;
                node.data %= 360; // clamp
                ret = new Path(newAngles);
            }
        });
        ret = ret || new Path(newAngles); // if there weren't any mutations
        return ret;
    };
    Path.prototype.randomMutation = function() {
        var p = 1/ this.path_angles.size();
        var newAngles = this.path_angles.clone();
        var ret = null;
        
        newAngles.preorderTraverse(function(node) {
            var prob = Math.random();
            if (prob < p) {
                var change;

                while (true) {
                    change = Math.floor(Math.random()*360);

                    // disallow changing the angle to 0
                    if (change !== 0) {
                        break;
                    }
                }
                node.data = change;
                
                ret = new Path(newAngles);
            }
        });
        
        ret = ret || new Path(newAngles);
        return ret;
    };
    
    Path.prototype.flipMutation = function() {
        var p = 1/ this.path_angles.size();
        var newAngles = this.path_angles.clone();
        var ret = null;
        
        newAngles.preorderTraverse(function(node) {
            if (Math.random() < p) {
                node.data *= -1;
                ret = new Path(newAngles);
            }
        });
        
        ret = ret || new Path(newAngles);
        return ret;
    };
    
    // http://www.kevlindev.com/gui/math/intersection/Intersection.js
    Path.prototype.intersectLineLine = function(a1, a2, b1, b2) {
        var result = [];
        
        var ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
        var ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
        var u_b  = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);

        if ( u_b != 0 ) {
            var ua = ua_t / u_b;
            var ub = ub_t / u_b;

            if ( 0 <= ua && ua <= 1 && 0 <= ub && ub <= 1 ) {
                //result = new Intersection("Intersection");
                result.push(a1.x + ua * (a2.x - a1.x));
                result.push(a1.y + ua * (a2.y - a1.y));
            } else {
                //result = new Intersection("No Intersection");
            }
        } else {
            if ( ua_t == 0 || ub_t == 0 ) {
                //result = new Intersection("Coincident");
            } else {
                //result = new Intersection("Parallel");
            }
        }

        return result;
    };

    
    self.useNewDistance = false;
    // Phenotypic distance of one path from another
    Path.prototype.getDistanceFromPerfect = function() {
        var n = 0, ret = {}, p1=0,p2=1, toInsert = 0;
        
        // Every 100th of the line
        for (var i = 0; i <= 1.0; i+= 0.01) {
            // Find (x,y) along perfect line
            var x = self.maze.xParaFn(i),
                y = self.maze.yParaFn(i);

            // y - y1 = m(x - x1)
            // Find using x = 0 and x = width
            var startY = self.maze.negGrad()*(-x) + y;
            var endY = self.maze.negGrad()*(self.maze.width-x) + y;
            
            var a1 = {x:0 , y:startY};
            var a2 = {x:self.maze.width, y:endY };
            var res = [];
            
            // Iterate along line segments, until we find an intersection
            for (p1 = 0, p2=1; p2 < this.points.length; p1++, p2++) {
                res = this.intersectLineLine(a1,a2, 
                    {x:this.points[p1][0], y:this.points[p1][1]}, 
                    {x:this.points[p2][0], y:this.points[p2][1]});
                if (res.length) 
                    break;
            }
            if (res.length === 0) {
                //console.log('No intersection!');
            } else {
                toInsert = this.euclideanDistance(res, [x,y]);
                self.ctx.fillRect(res[0]-2,res[1]-2,4,4);
            }
            ret[i] = toInsert;
            
            //self.ctx.strokeStyle = '#f00';
            //self.ctx.moveTo(0,startY);
            //self.ctx.lineTo(self.maze.width, endY);
            //self.ctx.stroke();
            //self.ctx.moveTo(self.maze.start_x,self.maze.start_y);
            //self.ctx.lineTo(self.maze.end_x,self.maze.end_y);
            //self.ctx.stroke();
        }
        
        return ret;
    }
    Path.prototype.distance = function(that) {
        if (self.useNewDistance) {
            var d1 = this.getDistanceFromPerfect(),
                d2 = that.getDistanceFromPerfect(),
                ret = 0;
            for (var k in d1) {
                ret += Math.abs(d1[k] - d2[k]);
            }
            //console.log(d1,d2,ret);
            //console.log("---");
            return ret;
        } else {
            // Find shortest path length
            var len = Math.min(this.points.length, that.points.length),
                i, totalDist = 0;
            for (i = 0; i < len; i++) {
                totalDist += this.euclideanDistance(this.points[i], that.points[i]);
            }
            return totalDist;
        }
    };
    
    Path.prototype.euclideanDistance = function(p1, p2) {
        return Math.sqrt(Math.pow((p2[0]-p1[0]),2) + Math.pow((p2[1]-p1[1]),2));
    };
    
    // Compare the path to other, 1 if this is fittest, -1 if that is fittest, 0 if it's a draw
    // A contained path will always be fitter than a non-contained path
    // A feasible path will always be fitter than a non-feasible path.
    Path.prototype.compare = function(that) {
        if (this.contained && that.contained) {
            if (this.feasible && that.feasible) {
                // both feasible, compare on length
                return (this.fitness >= that.fitness);
            } else if(this.feasible) {
                return true;
            } else if(that.feasible) {
                return false;
            } else {
                // Both unfeasible, compare only intersections
                return (this.fitness >= that.fitness);
            }
        } else if (this.contained) {
            return true;
        } else if (that.contained) {
            return false;
        } else {
            // Both not contained, go by fitness
            return (this.fitness >= that.fitness);
        }
    }

    // Available mazes
    // x,y, Width, Height
    var m1 = [
            [[173,0,45,32]],
            [[0,66,218,32], [173,82,45,79], [196,98,107,33]],
            [[474,0,43,161], [389,98,116,33]],
            [[0,195,389,32]],
            [[474,195,43,64], [496,195,151,32]],
            [[0,292,130,32]],
            [[173,357,44,131]],
            [[217,292,386,32], [344,317,45,171], [344,317,45,171], [376,389,199,33], [560,357,43,96]],
        ];
    var m2 = [
            [[0,0,525,61] ,[0,61,34,371] ,[493,61,32,371] ,[0,432,525,61]],
            [[194,61,17,28]],
            [[69,133,53,27]],
            [[265,117,69,30], [300,147,34,70], [334,175,54,42], [265,190,35,27], [354,217,33,15], [354,232,70,15], [334,247,54,14]],
            [[159,247,70,27], [194,274,35,100]], 
            [[300,347,34,42] ,[334,362,36,70]]
        ];
    var m3 = [
            [[0,0,525,61], [0,61,34,371], [493,61,32,371] ,[0,432,525,61]],
            [[194,61,17,28]],
            [[69,133,53,27]],
            [[265,117,69,30], [300,147,34,70], [334,175,54,42], [265,190,35,27], [354,217,33,15], [354,232,70,15], [334,247,54,14]],
            [[50,247,170,27], [194,274,35,160]],
            [[300,347,34,42] ,[334,362,36,70]]
        ];
    var m4 = [
            [[127,79,357,47], [127,126,47,168], [437,126,47,168]]
        ];
    self.mazes = [
                    new Maze(20,473, 635,16, m1, 647, 488, "Corridor-like environment."),
                    new Maze(89,389, 436,103, m2, 525, 493, "Sparse environment."),
                    new Maze(89,389, 436,103, m3, 525, 493, "Sparse environment with difficult-to-find exit from start."),
                    new Maze(299,30, 304,180, m4, 647, 488, "'U'-shaped environment")
                ];

    // GA stuff
    self.population = [];
    self.whichMaze = 0;
    self.startPopSize = 40;
    self.reset = function() {
        self.population = [];
        self.generation = 0;
        self.ctx.clearRect(0, 0, 1024, 1024);
    };
    self.toggleDrawFittest = function() {
        self.drawFittest = !self.drawFittest;
    };
    self.start = function (popSize) {
        // Initialise the maze and population, and draw for the first time
        popSize = popSize || self.startPopSize; 
        var m = self.mazes[self.whichMaze];
        self.maze = m;
        
        // display the environment description
        $('#environmentName').text(m.desc)

        for (var i = 0; i < popSize; i++) {
            self.population.push( new Path() );
        }
        // Draw maze
        m.draw(self.ctx);
        for (i = 0; i< self.population.length; i++) {
            self.population[i].draw(self.ctx);
        }
    };
    self.fittest = null;
    self.generationLimit = 0;
    self.paused = false;
    self.crowding = false;
    self.sharing = false;
    self.rog = false;
    self.hillclimber = false;
    self.sharingRadius = 50;

    // Sharing function
    self.sharingFn = function(p1, p2) {
        var ret = 0;

        var dist = p1.distance(p2);
        if (dist < self.sharingRadius) {
            ret = 1 - Math.pow(dist/self.sharingRadius, 1);
        }

        return ret;
    }
    self.toggleHillclimber = function() {
        self.hillclimber = !self.hillclimber;
        
        if (self.hillclimber) {
            self.reset();
            self.clearAndDrawEnv();
            self.start(1);
        } else {
            self.regen.click();
        }
    }
    self.offspringGeneration = function(par1, par2) {
        if (self.rog && (par1.distance(par2) < 50)) {
            // same genotype, random replace
            c1 = par1; // keep one in the population
            c2 = new Path(); // randomly generate a new Path
        } else {
            var crossoverResult = par1.crossoverWith(par2);
            c1 = crossoverResult[0].mutate();
            c2 = crossoverResult[1].mutate();
        }
        return [c1, c2];
    };
    self.clearAndDrawEnv = function() {
        self.ctx.clearRect(0, 0, 1024, 1024);
        self.maze.draw(self.ctx);
    };
    self.run = function() {
        if (self.generation >= self.generationLimit || self.paused) {
            return;
        }
        self.generation++;
        self.updateProbs();

        // Hillclimber or GA
        if (self.hillclimber) {
            var oldPath = self.population[0];
            var newPath = oldPath.mutate();
            if (newPath.compare(oldPath)) {
                self.population[0] = newPath;
            }
        } else {
            // Fitness sharing
            if (self.sharing) {
                for (var i = 0; i < self.population.length; i++) {
                    // f_{share}(i) = f_{raw}(i) / Sigma_{j=1}^{N} = sh(d_{ij})
                    var sharedFitness;
                    var sum = 0;

                    for (var j = 0; j < self.population.length; j++) {
                        // A path can't share with itself
                        if (i===j) continue;

                        sum += self.sharingFn(self.population[i], self.population[j]);
                    }
                    if (sum > 0) {
                        sharedFitness = Math.pow(self.population[i].fitness,2) / sum;
                    } else {
                        sharedFitness = self.population[i].fitness;
                    }
                    self.population[i].sharedFitness = sharedFitness;
                }

                for (i = 0; i < self.population.length; i++) {
                    self.population[i].fitness = self.population[i].sharedFitness;
                }
            }
            
            // If crowding is in use, otherwise just perform normal selection
            if (self.crowding) {
                self.population.shuffle();

                var i, p1, p2, c1, c2;
                for (i = 0; i < self.population.length-1; i += 2) {
                    p1 = self.population[i];
                    p2 = self.population[i+1];

                    var crossoverResult = self.offspringGeneration(p1,p2);
                    c1 = crossoverResult[0].mutate();
                    c2 = crossoverResult[1].mutate();

                    if ( (p1.distance(c1) + p2.distance(c2)) <= (p1.distance(c2) + p2.distance(c1))) {
                        (c1.compare(p1)) && (self.population[i]   = c1);
                        (c2.compare(p2)) && (self.population[i+1] = c2);
                    } else {
                        (c2.compare(p1)) && (self.population[i]   = c2);
                        (c1.compare(p2)) && (self.population[i+1] = c1);
                    }
                }
            } else {
                // Selection
                var newPaths = [];
                for (var i = 0; i< 15; i++) {
                    var p1cand = [Math.floor(Math.random() * self.population.length), Math.floor(Math.random() * self.population.length)];
                    var p2cand = [Math.floor(Math.random() * self.population.length), Math.floor(Math.random() * self.population.length)];

                    var p1 = (self.population[p1cand[0]].compare(self.population[p1cand[1]])) ? self.population[p1cand[0]] : self.population[p1cand[1]];
                    var p2 = (self.population[p2cand[0]].compare(self.population[p2cand[1]])) ? self.population[p2cand[0]] : self.population[p2cand[1]];

                    var children = self.offspringGeneration(p1,p2);
                    var c1 = children[0].mutate(),
                        c2 = children[1].mutate();
                    newPaths.push(c1);
                    newPaths.push(c2);
                }

                // Find (unique) indices of unfit paths to replace
                var indicesToReplace = [];
                for (i = 0; i< newPaths.length; i++) {
                    while (true) {
                        var a = Math.floor( Math.random() * self.population.length );
                        var b = Math.floor( Math.random() * self.population.length );
                        var toReplace = self.population[a] > self.population[b] ? b : a;

                        if ( $.inArray(toReplace, indicesToReplace) == -1) {
                            indicesToReplace.push(toReplace);
                            break;
                        }
                    }
                }

                // Reinsert back into population
                for (i = 0; i< indicesToReplace.length; i++) {
                    self.population[indicesToReplace[i]] = newPaths[i];
                }
            }
        }
        
        // Drawing
        self.clearAndDrawEnv();
                
        // Draw pop
        var min = null;
        for (i = 0; i< self.population.length; i++) {
            if (!min || self.population[i].compare(min)) {
                min = self.population[i];
            }
        }
        self.fittest = min;
        if (self.drawFittest) {
            min.draw(self.ctx);
        } else {
            for (i = 0; i< self.population.length; i++) {
                self.population[i].draw(self.ctx);
            }
        }
        
        // Update UI
        self.updateStatus();
        
        // Stats
        self.logStats();
        
        // Again
        setTimeout(function() {
            self.run();
        }, 0);
    };
    
    self.updateStatus = function() {
        var str = "Generation: " + self.generation + "</br>";
        for (var i = 0; i < self.population.length; i++) {
            str += i + " Fitness:" + self.population[i].fitness + '::' + self.population[i].path_angles.pprint() + '</br>';
        }
        $(status).html(str);
    };
    
    self.stats = {
        FITNESS_OVER_TIME : [],
        FITTEST_FITNESS : []
    };
    self.logStats = function() {
        var avg = 0;
        for (var i =0; i < self.population.length; i++ ) {
            avg += self.population[i].fitness;
        }
        avg /= self.population.length;
        
        var entry = [self.generation, avg];
        
        self.stats.FITNESS_OVER_TIME.push(entry);
        
        if (isNaN(self.fittest.fitness)) {
            console.log(self.fittest);
            console.log(self.population);
        }
        
        self.stats.FITTEST_FITNESS.push([self.generation, self.fittest.fitness]);
    };
    
    self.showStats = function() {
        $('#stats').html(self.stats.FITNESS_OVER_TIME.toString());
    };
    
    self.recalcPathStartEnd = function() {
        for (var i = 0; i < self.population.length; i++) {
            var p = self.population[i];
            p.points = [];
            p.calcFitness();
        }
    };

    self.init = function() {
        var this_ref = this;
        
        // find the canvas
        self.ctx = canvas.getContext('2d');
        self.ctx.strokeStyle = '#f00';
    
        // Setup controls
        self.paused = false;
        var b = $('<button type="button"></button>').appendTo(controls)
            .text('Start');
        var g = $('<input type="text"/>').appendTo(controls)
            .val('100000');
        b.click(function(){
            self.generation = self.generation || 0;
            self.generationLimit = self.generationLimit + parseInt(g.val(),10);
            self.run(self.generation);
        });
        var pause = $('<button type="button"></button>').appendTo(controls)
            .text('toggle pause')
            .click(function(){
                self.paused = !self.paused;
                if (!self.paused) {
                    self.run();
                }
            });
        $('<br/>').appendTo(controls);
        var p = $('<input type="text"/>').appendTo(controls)
            .val(self.startPopSize);
        self.regen = $('<button type="button"></button>').appendTo(controls)
            .text('Regen+Reset')
            .click(function(){
                self.reset();
                self.generationLimit = parseInt(g.val(),10);
                self.start(p.val());
            });
        var toggle = $('<button type="button"></button>').appendTo(controls)
            .text('Toggle: Draw all paths')
            .toggle(function(){
                self.toggleDrawFittest();
                toggle.text('Toggle: Draw only fittest');
            }, function(){
                self.toggleDrawFittest();
                toggle.text('Toggle: Draw all paths');
            });
        var crowding = $('<button type="button"></button>').appendTo(controls)
            .text('Toggle: Crowding off')
            .toggle(function(){
                self.crowding = !self.crowding;
                crowding.text('Toggle: Crowding on');
            }, function(){
                self.crowding = !self.crowding;
                crowding.text('Toggle: Crowding off');
            });
        var sharing = $('<button type="button"></button>').appendTo(controls)
            .text('Toggle: Sharing off')
            .toggle(function(){
                self.sharing = !self.sharing;
                sharing.text('Toggle: Sharing on');
            }, function(){
                self.sharing = !self.sharing;
                sharing.text('Toggle: Sharing off');
            });
        var rog = $('<button type="button"></button>').appendTo(controls)
            .text('Toggle: rog off')
            .toggle(function(){
                self.rog = !self.rog;
                rog.text('Toggle: rog on');
            }, function(){
                self.rog = !self.rog;
                rog.text('Toggle: rog off');
            });
        var hillclimber = $('<button type="button"></button>').appendTo(controls)
            .text('Toggle: Hillclimber off')
            .toggle(function(){
                self.toggleHillclimber();
                hillclimber.text('Toggle: Hillclimber on');
            }, function(){
                self.toggleHillclimber();
                hillclimber.text('Toggle: Hillclimber off');
            });
        $('<br/><br/>').appendTo(controls);
        var stats = $('<button type="button"></button>').appendTo(controls)
            .text('Show/Update stats')
            .click(function(){
                self.showStats();
            });

        // Add a separator
        $('<br/><br/><div>Switch Environment:</div>').appendTo(controls);

        // Switch which maze
        var prevMaze = $('<button type="button"></button>').appendTo(controls)
            .text("<-")
            .click(function(){
                if ((self.whichMaze - 1) >= 0) {
                    self.whichMaze--;
                    self.regen.click();
                }
            });
        var nextMaze = $('<button type="button"></button>').appendTo(controls)
            .text("->")
            .click(function(){
                if ((self.whichMaze + 1) < (self.mazes.length)) {
                    self.whichMaze++;
                    self.regen.click();
                }
            });
        
        crowding.click();

        // Set up handlers for the canvas
        $(canvas).mousedown(function(e){
            var x = e.offsetX,
                y = e.offsetY;
            if (x > self.maze.start_x - 5 && x < self.maze.start_x + 5 &&
                y > self.maze.start_y -5 && y < self.maze.start_y + 5) {
                self.isDraggingStart = true;
            } else if (x > self.maze.end_x - 5 && x < self.maze.end_x + 5 &&
                y > self.maze.end_y -5 && y < self.maze.end_y + 5) {
                self.isDraggingEnd = true;
            }
        });
        $(canvas).mouseup(function(){
            self.isDraggingStart = false;
            self.isDraggingEnd = false;
        });
        $(canvas).mousemove(function(e){
            var x = e.offsetX,
                y = e.offsetY;
            if (self.isDraggingStart) {
                self.maze.start_x = x;
                self.maze.start_y = y;
                self.recalcPathStartEnd();
            } else if (self.isDraggingEnd) {
                self.maze.end_x = x;
                self.maze.end_y = y;
                self.recalcPathStartEnd();
            }
        });
        this_ref.start();
    };
    
    ////////////////////////////
    // Binary Tree Stuf
    ////////////////////////////
    var BinaryTree = function(data) {
        this.data = data;
        this.leftChild = null;
        this.rightChild = null;
    };
    BinaryTree.prototype.addLeftChild = function(data){
        this.leftChild = new BinaryTree(data);
    };
    BinaryTree.prototype.addRightChild = function(data){
        this.rightChild = new BinaryTree(data);
    };
    BinaryTree.prototype.clone = function(){
        // clone root
        var newTree = new BinaryTree(this.data);
        
        // clone left and right if they exist
        if (this.leftChild) {
            newTree.leftChild = this.leftChild.clone();
        }
        if (this.rightChild) {
            newTree.rightChild = this.rightChild.clone();
        }
        return newTree;
    };
    BinaryTree.prototype.size = function() {
        var length = 0;
        this.preorderTraverse(function() {
            length++;
        });
        return length;
    };
    BinaryTree.prototype.preorderTraverse = function (fn) {
        var node = this;
        
        fn.call(this, node);
        if (this.leftChild) {
            this.leftChild.preorderTraverse(fn);
        }
        if (this.rightChild) {
            this.rightChild.preorderTraverse(fn);
        }
    };
    BinaryTree.prototype.crossoverWith = function (other) {     // nicer named fn
        var ret = this.subTreeCrossover(other);
        var c1 = ret[0],
            c2 = ret[1];
        c1.trim();
        c2.trim();
        return [c1, c2];
    };
    BinaryTree.prototype.trim = function(depth) {
        depth = depth || 0;
        
        if (depth >= 6) {
            // remove children, no need to recurse further
            this.leftChild = null;
            this.rightChild = null;
        } else {    
            if (this.leftChild) {
                this.leftChild.trim(depth+1);
            }
            if (this.rightChild) {
                this.rightChild.trim(depth+1);
            }
        }
    };
    BinaryTree.prototype.subTreeCrossover = function(that) {
        // Create clones of both, to be modified
        var thisClone = this.clone();
        var thatClone = that.clone();
        
        // The node to replace in this, and the node to replace it with from that
        var thisPointIndex = Math.floor(Math.random() * thisClone.size());
        var thatPointIndex = Math.floor(Math.random() * thatClone.size());
        
        // References to the nodes to swap
        var thisNode = null, 
            thatNode = null;
        
        // Iterate through until we find the nodes we want...
        thisClone.preorderTraverse(function(node){
            if ( thisPointIndex === 0 ) {
                thisNode = node;
            }
            thisPointIndex--;
        });
        thatClone.preorderTraverse(function(node){
            if ( thatPointIndex === 0 ) {
                thatNode = node;
            } 
            thatPointIndex--;
        });
        
        // Store the values of thisNode
        var thisNodeClone = thisNode.clone();
        
        // Stop the tree from tending towards 1 angle
        if (!thisClone.leftChild || !thisClone.rightChild) {
            if (!thisClone.leftChild) {
                thisClone.leftChild = thatNode;
            } else {
                thisClone.rightChild = thatNode;
            }
        } else {
            // And copy
            thisNode.data = thatNode.data;
            thisNode.leftChild  = thatNode.leftChild;
            thisNode.rightChild = thatNode.rightChild;
        }
        
        if (!thatClone.leftChild || !thatClone.rightChild) {
            if (!thatClone.leftChild) {
                thatClone.leftChild = thisNodeClone;
            } else {
                thatClone.rightChild = thisNodeClone;
            }
        } else {
            thatNode.data = thisNodeClone.data;
            thatNode.leftChild = thisNodeClone.leftChild;
            thatNode.rightChild = thisNodeClone.rightChild;
        }
        return [thisClone, thatClone];
    };
    BinaryTree.prototype.pprint = function() {
        var str = "[" + this.data;
        str += ", " 
        if (this.leftChild) {
            str += this.leftChild.pprint();
        } else {
            str += "[]"
        }
        str += ", " 
        if (this.rightChild) {
            str += this.rightChild.pprint();
        } else {
            str += "[]"
        }
        str += "]";
        return str;
    };
    BinaryTree.prototype.hasEmptyLink = function() {
        return ( !(this.leftChild) || !(this.rightChild) );
    };
    ////////////////////////////
    // Angle Stuff
    ////////////////////////////
    this.deg2rad = function(d){
        return d * (Math.PI / 180.0);
    };
    this.rad2deg = function(r){
        return r * (180.0/Math.PI);
    };
    this.angleFromNorth = function (centre, p1) {
        var p0 =    [
                        centre[0], 
                        centre[1] - Math.sqrt(Math.abs(p1[0] - centre[0]) * 
                            Math.abs(pp1[0] - centre[0]) + Math.abs(p1[1] - centre[1]) *
                            Math.abs(p1[1] - centre[1]))
                    ];
        return (2 * Math.atan2(p1[1] - p0[1], p1[0] - p0[0])) * 180 / Math.PI;
    };
    this.getPointAt = function(centre, radius, angle) {
        angle = deg2rad(angle);
        return  [   
                    centre[0] + Math.sin(Math.PI - angle) * radius,
                    centre[1] + Math.cos(Math.PI - angle) * radius
                ];
    };
    
    return self;
})(jQuery, document.getElementById('canvas'), document.getElementById('status'), document.getElementById('controls'));
