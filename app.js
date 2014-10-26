angular.module('d3', [])
  .factory('d3Service', ['$document', '$q', '$rootScope',
    function($document, $q, $rootScope) {
      var d = $q.defer();
      function onScriptLoad() {
        // Load client in the browser
        $rootScope.$apply(function() { d.resolve(window.d3); });
      }

      var scriptTag = $document[0].createElement('script');
      scriptTag.type = 'text/javascript';
      scriptTag.async = true;
      scriptTag.src = 'http://d3js.org/d3.v3.min.js';
      scriptTag.onreadystatechange = function () {
        if (this.readyState == 'complete') { onScriptLoad(); }
      }
      scriptTag.onload = onScriptLoad;

      var s = $document[0].getElementsByTagName('body')[0];
      s.appendChild(scriptTag);

      return {
        d3: function() { return d.promise; }
      };
    }
  ]);

angular.module('abTreePractice', ['d3'])
  .constant('NodeEnum', {
    maxNode: 'maxNode',
    minNode: 'minNode',
    randNode: 'randNode',
    leafNode: 'leafNode',
  })
  .controller('MainCtrl', ['NodeEnum', '$scope', function(NodeEnum, $scope) {
    $scope.oppositeNode = function(nodeType) {
      if (nodeType == NodeEnum.maxNode) {
        return NodeEnum.minNode;
      } else if (nodeType == NodeEnum.minNode) {
        return NodeEnum.maxNode;
      }
      return nodeType;
    };

    $scope.maxVal = 20;

    $scope.generateRootNode = function(maxFirst) {
      var generateSubTree = function(parentNode, nodeType, depth, bFac, maxDepth) {
        var curNode = new TreeNode(depth, nodeType, bFac, parentNode);
        if (depth == maxDepth) {
          curNode.value = Math.round(Math.random() * (2 * $scope.maxVal)) -
            $scope.maxVal;
          curNode.nodeType = NodeEnum.leafNode;
        } else {
          for (var k = 0; k < bFac; k++) {
            curNode.setKthChild(k,
                generateSubTree(curNode, $scope.oppositeNode(nodeType),
                  depth + 1, bFac, maxDepth));
          }
        }
        return curNode;
      }
      $scope.tree.rootNode =
        generateSubTree(null, $scope.tree.treeType, 1,
            $scope.tree.branchingFactor, $scope.tree.depth);
    };
    $scope.tree = new Tree(3, 3, NodeEnum.maxNode, null);
    $scope.generateRootNode();

    $scope.incrBranchingFactor = function(incr) {
      $scope.tree.branchingFactor = Math.max(2,
          $scope.tree.branchingFactor + incr);
      $scope.generateRootNode();
    };
    $scope.incrDepth = function(incr) {
      $scope.tree.depth = Math.max(3,
          $scope.tree.depth + incr);
      $scope.generateRootNode();
    };
    $scope.flipMax = function() {
      $scope.tree.treeType = $scope.oppositeNode($scope.tree.treeType);
      $scope.generateRootNode();
    };

  }])
  .directive('abTree', ['NodeEnum', 'd3Service', function(NodeEnum, d3Service) {
    return {
      restrict: 'E',
      scope: {
        tree: '=',
      },
      link: function(scope, element, attrs) {
        var svgWidth = 1200,
            svgHeight = 800,
            svgMargin = 40,
            nodeSideLength = 80,
            triNodeHeight = Math.sqrt(Math.pow(nodeSideLength, 2) -
                Math.pow((nodeSideLength/2), 2)),
            backgroundColor = '#eeeeee';

        d3Service.d3().then(function(d3) {
          var colors = d3.scale.category10();

          var svg = d3.select(element[0])
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight)
            .style('background', backgroundColor);

          var lastNodeId = -1;
          var nodes = [],
              links = [];
          var updateD3Tree = function(root, nodes, links) {
            var bFac = scope.tree.branchingFactor,
                maxDepth = scope.tree.depth,
                yOffset = (svgHeight - (2 * svgMargin)) / (maxDepth + 1);

            var updateD3SubTree = function(curNode, xMin, xMax, nodes, links) {
              if (!curNode) { return; }
              var range = xMax - xMin;
              var newOffset = range / bFac;
              var yPos = svgMargin + (yOffset * curNode.depth);
              var xPos = xMin + (range / 2);

              curNode.id = ++lastNodeId;
              curNode.x = xPos;
              curNode.y = yPos;
              nodes.push(curNode);
              if (curNode.parentNode) {
                links.push({source: curNode.parentNode, target: curNode});
              }
              for (var k = 0; k < bFac; k++) {
                var kthChild = curNode.getKthChild(k);
                updateD3SubTree(kthChild,
                                xMin + (newOffset * k),
                                xMin + (newOffset * (k + 1)),
                                nodes,
                                links
                               );
              }
            };
            updateD3SubTree(root, svgMargin, svgWidth - svgMargin, nodes, links);
          };

          scope.$watchCollection('tree', function(newValues, oldValues) {
            nodes = [];
            links = [];
            updateD3Tree(scope.tree.rootNode, nodes, links);
            restart();
          });

          // handles to link and node element groups
          var path = svg.append('svg:g').selectAll('path'),
              vertex = svg.append('svg:g').selectAll('g');

          // mouse event vars
          var selectedNode = null,
              mousedownNode = null,
              mouseupNode = null;

          var resetMouseVars = function() {
            mousedownNode = null;
            mouseupNode = null;
            mousedownLink = null;
          };

          // line displayed when dragging new nodes
          var dragVertex = svg.append('svg:g')

          // update graph (called when needed)
          var restart = function() {
            // path (link) group
            path = path.data(links, function(link) {
              return link.source.id + ',' + link.target.id
            });

            // update existing links
            path.select('path.link').classed('selected', function(d) { return d.selected; });

            // add new links
            var newLinks = path.enter().append('svg:g');
            newLinks.append('svg:path')
              .attr('class', 'link')
              .classed('selected', function(d) { return d.selected; })
              .attr('d', function(d) {
                return 'M' + d.source.x + ',' + d.source.y +
                       'L' + d.target.x + ',' + d.target.y;
              })
            newLinks.append('svg:path')
              .attr('class', 'mouselink')
              .attr('d', function(d) {
                return 'M' + d.source.x + ',' + d.source.y +
                       'L' + d.target.x + ',' + d.target.y;
              })
              .on('mousedown', function(d) {
                d.selected = !d.selected;
                restart();
              });

            // remove old links
            path.exit().remove();

            // vertex (node) group
            // NB: the function arg is crucial here! nodes are known by id, not by index!
            vertex = vertex.data(nodes, function(d) { return d.id; });

            // add new nodes
            var g = vertex.enter().append('svg:g');

            g.append('svg:path')
              .attr('class', 'node')
              .attr('d', function(d) {
                var s = nodeSideLength;
                if (d.nodeType == NodeEnum.leafNode) {
                  var ns = s / 2.1;
                  var a = (s - ns) / 2;
                  // square leaf nodes
                  return 'M' + a + "," + -a +
                         'L' + (ns + a) + "," + -a +
                         'L' + (ns + a) + "," + (-ns - a) +
                         'L' + a + "," + (-ns - a) +
                         'L' + a + "," + -a;
                }
                var h = triNodeHeight;
                // triangular min/max nodes
                return 'M' + 0 + "," + 0 +
                       'L' + s + "," + 0 +
                       'L' + (s/2) + "," + -h +
                       'L' + 0 + "," + 0;
              })
              .attr('transform', function(d) {
                var halfSide = nodeSideLength / 2,
                    halfHeight = triNodeHeight / 2;
                var t = '', r = '';
                if (d.nodeType == NodeEnum.leafNode) {
                  t = 'translate(' +
                           (d.x - halfSide) + ',' +
                           (d.y + halfSide) + ')';
                  r = '';
                } else if (d.nodeType == NodeEnum.maxNode) {
                  t = 'translate(' +
                           (d.x - halfSide) + ',' +
                           (d.y + halfHeight) + ')';
                } else if (d.nodeType == NodeEnum.minNode) {
                  t = 'translate(' +
                           (d.x + halfSide) + ',' +
                           (d.y - halfHeight) + ')';
                  r = ' rotate(180)';
                }
                return t + r;
              })
              .style('fill', function(d) { return (d === selectedNode) ? d3.rgb(colors(d.id)).brighter().toString() : 'white'; })
              .style('stroke', function(d) { return 'black'; })
              .on('mousedown', function(d) {
                // select node
                mousedownNode = d;
                d.oldVal = d.value;
                d.nodeEle = d3.select(this.parentNode);
                restart();
              });

            // show node IDs
            g.append('svg:text')
              .attr('class', 'value')

            // remove old nodes
            vertex.exit().remove();

            // update existing node values
            vertex.select('text.value')
              .attr('x', function(d) { return d.x })
              .attr('y', function(d) { return d.y + 6 })
              .text(function(d) { return (d.value != null) ? d.value : ''; });

            // update existing cursor
            vertex.select('rect.cursor')
              .attr('x', function(node) {
                var nodeVal = node.value;
                var valStr = (nodeVal == null) ? '' : nodeVal.toString();

                var valSVG = d3.select(this.parentNode).select('text').node();
                var valSVGLength = valSVG
                  ? valSVG.getComputedTextLength()
                    : 0;

                var xAdjust = valSVGLength / (valStr.length + Number.MIN_VALUE);
                return node.x - (valSVGLength / 2) + (xAdjust * valCharIndex) - 0.5;
              })
              .attr('y', function(node) {
                return node.y - 8;
              });

              // .on('mouseover', function(d) {
              //   if (!mousedownNode || d === mousedownNode) {
              //     return;
              //   }
              //   // enlarge target node
              //   d3.select(this).attr('transform', 'scale(1.1)');
              // })
              // .on('mouseout', function(d) {
              //   if (!mousedownNode || d === mousedownNode) {
              //     return;
              //   }
              //   // unenlarge target node
              //   d3.select(this).attr('transform', '');
              // })
              // .on('mouseup', function(d) {
              //   if (!mousedownNode) {
              //     return;
              //   }
              //
              //   // needed by FF
              //   dragLine
              //     .classed('hidden', true)
              //     .style('marker-end', '');
              //
              //   // check for drag-to-self
              //   mouseupNode = d;
              //   if (mouseupNode === mousedownNode) {
              //     resetMouseVars(); return;
              //   }
              //
              //   // unenlarge target node
              //   d3.select(this).attr('transform', '');
              //
              //   // add link to graph (update if exists)
              //   // NB: links are strictly source < target; arrows separately specified by booleans
              //   var source, target, direction;
              //   if (mousedownNode.id < mouseupNode.id) {
              //     source = mousedownNode;
              //     target = mouseupNode;
              //     direction = 'right';
              //   } else {
              //     source = mouseupNode;
              //     target = mousedownNode;
              //     direction = 'left';
              //   }
              //
              //   var link;
              //   link = links.filter(function(l) {
              //     return (l.source === source && l.target === target);
              //   })[0];
              //
              //   if (link) {
              //     link[direction] = true;
              //   } else {
              //     link = {source: source, target: target, left: false, right: false};
              //     link[direction] = true;
              //     links.push(link);
              //   }
              //
              //   // select new link
              //   selectedLink = link;
              //   selectedNode = null;
              //   restart();
              // });

          };

          // node value editing variables and functions
          var valCharIndex = null,
              cursorRect = null,
              valStr = null;
          function incrValCharIndex() {
            valCharIndex = Math.min(valCharIndex + 1, valStr.length);
          }
          function decrValCharIndex() {
            valCharIndex = Math.max(0, valCharIndex - 1);
          }
          function parseAndSetNodeValue() {
            var newVal = parseFloat(valStr);
            newVal = (isNaN(newVal)) ? null : newVal;
            selectedNode.value = newVal;

            valCharIndex = null;
            valStr = null;
            selectedNode = null;
            cursorRect.remove();
            cursorRect = null;
          }
          function discardNodeValueChanges() {
            selectedNode.value = selectedNode.oldVal;
            valCharIndex = null;
            valStr = null;
            selectedNode = null;
            cursorRect.remove();
            cursorRect = null;
          }

          function svgMouseDown() {
            if (selectedNode && (mousedownNode !== selectedNode)) {
              parseAndSetNodeValue();
            }

            if (mousedownNode) {
              if (mousedownNode === selectedNode) { return; }
              selectedNode = mousedownNode;
              mousedownNode = null;

              nodeValue = selectedNode.value
              valStr = (nodeValue == null) ? '' : nodeValue.toString();
              valCharIndex = valStr.length;

              window.v = selectedNode.nodeEle
              cursorRect = selectedNode.nodeEle
                .append('svg:rect')
                .attr('class', 'cursor')
                .attr('height', 16.5)
                .attr('width', 1.5);

              /*
              cursorRect.append('svg:set')
                .attr('id', 'show')
                .attr('attributeName', 'visibility')
                .attr('attributeType', 'CSS')
                .attr('to', 'visible')
                .attr('begin', '0s; hide.end')
                .attr('dur', '0.5s')
                .attr('fill', 'frozen');
              cursorRect.append('svg:set')
                .attr('id', 'hide')
                .attr('attributeName', 'visibility')
                .attr('attributeType', 'CSS')
                .attr('to', 'hidden')
                .attr('begin', 'show.end')
                .attr('dur', '0.5s')
                .attr('fill', 'frozen');
              */

              restart();
            }
          }

          // only respond once per keydown
          var lastKeyDown = -1;

          function windowKeyDown() {

            lastKeyDown = d3.event.keyCode;

            // Editing Edge Weights
            if (selectedNode) {
              var nodeVal = selectedNode.value;
              valStr = (nodeVal == null) ? '' : nodeVal.toString();
              if ((lastKeyDown > 47 && lastKeyDown < 58) // number keys
                  || lastKeyDown == 189 // minus dash
                  || lastKeyDown == 190) { // decimal point
                var leftSlice = valStr.slice(0, valCharIndex),
                    rightSlice = valStr.slice(valCharIndex, valStr.length),
                    lastKeyDown = (lastKeyDown > 188) ? (lastKeyDown - 144) : lastKeyDown,
                    newNum = String.fromCharCode(lastKeyDown);
                valStr = leftSlice + newNum + rightSlice;
                selectedNode.value = valStr;
                incrValCharIndex();
              } else if (lastKeyDown == 8) { // backspace
                d3.event.preventDefault();
                var leftSlice = valStr.slice(0, Math.max(0, valCharIndex - 1)),
                    rightSlice = valStr.slice(valCharIndex, valStr.length);
                valStr = leftSlice + rightSlice;
                selectedNode.value = valStr;
                decrValCharIndex();
              } else if (lastKeyDown == 37) {  // left arrow
                decrValCharIndex();
              } else if (lastKeyDown == 39) {  // right arrow
                incrValCharIndex();
              } else if (lastKeyDown == 13) {  // enter
                parseAndSetNodeValue();
              } else if (lastKeyDown == 27) {  // escape
                discardNodeValueChanges();
              }
              restart();
              return;
            }

          }

          function windowKeyUp() {
            lastKeyDown = -1;
          }

          svg.on('mousedown', svgMouseDown);
          d3.select(window)
            .on('keydown', windowKeyDown)
            .on('keyup', windowKeyUp)
          restart();

          // function mousedown() {
          //   // prevent I-bar on drag
          //   //d3.event.preventDefault();
          //
          //   // because :active only works in WebKit?
          //   svg.classed('active', true);
          //
          //   if (d3.event.ctrlKey || mousedownNode || mousedownLink) {
          //     return;
          //   }
          //
          //   // insert new node at point
          //   var point = d3.mouse(this),
          //       node = {id: ++lastNodeId, reflexive: false};
          //   node.x = point[0];
          //   node.y = point[1];
          //   nodes.push(node);
          //
          //   restart();
          // }
          //
          // function mousemove() {
          //   if (!mousedownNode) {
          //     return;
          //   }
          //
          //   // update drag line
          //   dragLine.attr('d', 'M' + mousedownNode.x + ',' + mousedownNode.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);
          //
          //   restart();
          // }
          //
          // function mouseup() {
          //   if (mousedownNode) {
          //     // hide drag line
          //     dragLine
          //       .classed('hidden', true)
          //       .style('marker-end', '');
          //   }
          //
          //   // because :active only works in WebKit?
          //   svg.classed('active', false);
          //
          //   // clear mouse event vars
          //   resetMouseVars();
          // }
          //

          // only respond once per keydown
          // var lastKeyDown = -1;
          //
          // function keydown() {
          //   d3.event.preventDefault();
          //
          //   if (lastKeyDown !== -1) {
          //     return;
          //   }
          //   lastKeyDown = d3.event.keyCode;
          //
          //   // ctrl
          //   if (d3.event.keyCode === 17) {
          //     vertex.call(force.drag);
          //     svg.classed('ctrl', true);
          //   }
          //
          //   if (!selectedNode && !selectedLink) {
          //     return;
          //   }
          //   switch(d3.event.keyCode) {
          //     case 8: // backspace
          //     case 46: // delete
          //       if (selectedNode) {
          //         nodes.splice(nodes.indexOf(selectedNode), 1);
          //         spliceLinksForNode(selectedNode);
          //       } else if (selectedLink) {
          //         links.splice(links.indexOf(selectedLink), 1);
          //       }
          //       selectedLink = null;
          //       selectedNode = null;
          //       restart();
          //       break;
          //     case 66: // B
          //       if (selectedLink) {
          //         // set link direction to both left and right
          //         selectedLink.left = true;
          //         selectedLink.right = true;
          //       }
          //       restart();
          //       break;
          //     case 76: // L
          //       if (selectedLink) {
          //         // set link direction to left only
          //         selectedLink.left = true;
          //         selectedLink.right = false;
          //       }
          //       restart();
          //       break;
          //     case 82: // R
          //       if (selectedNode) {
          //         // toggle node reflexivity
          //         selectedNode.reflexive = !selectedNode.reflexive;
          //       } else if (selectedLink) {
          //         // set link direction to right only
          //         selectedLink.left = false;
          //         selectedLink.right = true;
          //       }
          //       restart();
          //       break;
          //   }
          // }
          //
          // function keyup() {
          //   lastKeyDown = -1;
          //
          //   // ctrl
          //   if (d3.event.keyCode === 17) {
          //     vertex
          //       .on('mousedown.drag', null)
          //       .on('touchstart.drag', null);
          //     svg.classed('ctrl', false);
          //   }
          // }
          //
          // // app starts here
          //   .on('mousemove', mousemove)
          //   .on('mouseup', mouseup);
          // d3.select(window)
          //   .on('keydown', keydown)
          //   .on('keyup', keyup);

          // whenever the bound 'exp' expression changes, execute this
          // scope.$watch('exp', function(newVal, oldVal) {
          // });
        });
      },
    };
  }]);
