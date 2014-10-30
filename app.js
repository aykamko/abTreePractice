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
  .constant('NodeEnum', treeNodeTypeEnum)
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
      $scope.tree.rootNode = Tree.generateABTreeRootNode(
        $scope.tree.treeType,
        $scope.tree.depth,
        $scope.tree.branchingFactor,
        -$scope.maxVal,
        $scope.maxVal
      );
      $scope.actionLQ = null;
    };
    $scope.tree = new Tree(null, NodeEnum.maxNode, 3, 3);
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

    $scope.checkAnswer = function() {
      if (!$scope.actionLQ) {
        $scope.actionLQ = $scope.tree.alphaBeta();
      }
      $scope.correct = $scope.tree.checkAnswer();
    }
    $scope.correct = null;

    $scope.reRender = function() { return; }
    $scope.actionLQ = null;
    $scope.alphaBeta = function() {
      if (!$scope.actionLQ) {
        $scope.actionLQ = $scope.tree.alphaBeta();
      }
      $scope.actionLQ.inAction = true;
    }
    $scope.stepForward = function() {
      if ($scope.actionLQ) {
        $scope.actionLQ.stepForward();
        $scope.reRender();
      }
    }
    $scope.stepBackward = function() {
      if ($scope.actionLQ) {
        $scope.actionLQ.stepBackward();
        $scope.reRender();
      }
    }

    $scope.resetTree = function() {
      $scope.tree.reset();
      $scope.reRender();
    }
    $scope.showSolution = function() {
      $scope.tree.setSolution();
      $scope.reRender();
    }

  }])
  .directive('abTree',
      ['NodeEnum',
       'd3Service',
       '$window',
       '$document',
       function(NodeEnum, d3Service, $window, $document) {
    return {
      restrict: 'E',
      scope: {
        tree: '=',
        reRender: '=',
      },
      link: function(scope, element, attrs) {
        angular.element($document).ready(function () {
          var svgMargin = 40,
              nodeSideLength = 80,
              triNodeHeight = Math.sqrt(Math.pow(nodeSideLength, 2) -
                  Math.pow((nodeSideLength/2), 2)),
              triCenterFromBaseDist = Math.sqrt(
                  Math.pow((nodeSideLength / Math.sqrt(3)), 2) -
                  Math.pow((nodeSideLength / 2),2));

        d3Service.d3().then(function(d3) {
          var svgWidth = 0,
              svgHeight = 0;

          var svg = d3.select(element[0])
            .append('svg');

          scope.onResize = function() {
            var navbarHeight = angular
              .element($document[0].getElementsByClassName('navbar'))[0]
              .offsetHeight;
            svgWidth = $window.innerWidth;
            svgHeight = $window.innerHeight - navbarHeight;
            svg.attr('width', svgWidth)
              .attr('height', svgHeight);
          }
          scope.onResize();

          var lastNodeId = -1;
          scope.renderD3Tree = function() {
            scope.nodes = [];
            scope.links = [];
            var root = scope.tree.rootNode,
                bFac = scope.tree.branchingFactor,
                maxDepth = scope.tree.depth,
                yOffset = (svgHeight - (2 * svgMargin)) / (maxDepth + 1);

            var renderD3SubTree = function(curNode, xMin, xMax, nodes, links) {
              if (!curNode) { return; }
              var range = xMax - xMin;
              var newOffset = range / bFac;
              var yPos = svgMargin + (yOffset * curNode.depth);
              var xPos = xMin + (range / 2);

              curNode.id = ++lastNodeId;
              curNode.x = xPos;
              curNode.y = yPos;
              nodes.push(curNode);
              if (curNode.edgeToParent) {
                links.push(curNode.edgeToParent);
              }
              for (var k = 0; k < bFac; k++) {
                var kthChild = curNode.getKthChild(k);
                renderD3SubTree(kthChild,
                                xMin + (newOffset * k),
                                xMin + (newOffset * (k + 1)),
                                nodes,
                                links
                               );
              }
            };
            renderD3SubTree(root, svgMargin, svgWidth - svgMargin,
                scope.nodes, scope.links);
            scope.reRender();
          };

          scope.$watch(function() { return scope.tree.rootNode; },
              scope.renderD3Tree);

          angular.element($window).bind('resize', function() {
            scope.onResize();
            clearTimeout(scope.resizeTimeout);
            scope.resizeTimeout = setTimeout(function() {
              scope.renderD3Tree();
              scope.reRender();
            }, 500);
          });

          // handles to link and node element groups
          var path = svg.append('svg:g').selectAll('path'),
              vertex = svg.append('svg:g').selectAll('g');

          // mouse event vars
          var selectedNode = null,
              mousedownNode = null;

          // update graph (called when needed)
          scope.reRender = function() {
            // path (link) group
            path = path.data(scope.links, function(link) {
              return link.source.id + ',' + link.target.id
            });

            // add new links
            var newLinks = path.enter().append('svg:g');
            newLinks.append('svg:path')
              .attr('class', 'link');
            newLinks.append('svg:path')
              .attr('class', 'mouselink')
              .on('mousedown', function(d) {
                d.pruned = !d.pruned;
                scope.reRender();
              })
              .on('mouseover', function(d) {
                // color target link
                d3.select(this.parentNode).select('path.link')
                  .classed('hover', true);
              })
              .on('mouseout', function(d) {
                // uncolor target link
                d3.select(this.parentNode).select('path.link')
                  .classed('hover', false);
              });

            // remove old links
            path.exit().remove();

            // update existing links
            path.select('path.link')
              .attr('d', function(d) {
                return 'M' + d.source.x + ',' + d.source.y +
                       'L' + d.target.x + ',' + d.target.y;
              })
              .classed('pruned', function(d) { return d.pruned; })
              .classed('entered', function(d) {
                return d.entered;
              });
            path.select('path.mouselink')
              .attr('d', function(d) {
                return 'M' + d.source.x + ',' + d.source.y +
                       'L' + d.target.x + ',' + d.target.y;
              });

            // vertex (node) group
            vertex = vertex.data(scope.nodes, function(d) { return d.id; });

            // add new nodes
            var newNodes = vertex.enter().append('svg:g')
              .classed('node', true)
              .classed('leaf', function(d) {
                return (d.nodeType == NodeEnum.leafNode);
              });
            newNodes.append('svg:path')
              .classed('nodepath', true)
              .each(function(d) {
                d.nodeEle = d3.select(this.parentNode);
              })
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
              .on('mousedown', function(d) {
                // select node
                mousedownNode = d;
                d.oldVal = d.value;
                scope.reRender();
              });
            // show node IDs and alpha-beta
            newNodes.append('svg:text')
              .attr('class', 'value');
            newNodes.append('svg:text')
              .attr('class', 'alpha');
            newNodes.append('svg:text')
              .attr('class', 'beta');

            // remove old nodes
            vertex.exit().remove();

            // update existing nodes
            vertex.classed('entered', function(d) { return d.entered; });
            vertex.select('path.nodepath')
              .attr('transform', function(d) {
                var halfSide = nodeSideLength / 2;
                var t = '', r = '';
                if (d.nodeType == NodeEnum.leafNode) {
                  t = 'translate(' +
                           (d.x - halfSide) + ',' +
                           (d.y + halfSide) + ')';
                  r = '';
                } else if (d.nodeType == NodeEnum.maxNode) {
                  t = 'translate(' +
                           (d.x - halfSide) + ',' +
                           (d.y + triCenterFromBaseDist) + ')';
                } else if (d.nodeType == NodeEnum.minNode) {
                  t = 'translate(' +
                           (d.x + halfSide) + ',' +
                           (d.y - triCenterFromBaseDist) + ')';
                  r = ' rotate(180)';
                }
                return t + r;
              });
            // update existing node values
            vertex.select('text.value')
              .attr('x', function(d) { return d.x })
              .attr('y', function(d) { return d.y + 6; })
              .text(function(d) { return (d.value != null) ? d.value : ''; });
            // update existing alpha-beta values
            vertex.select('text.alpha')
              .attr('x', function(d) { return d.x + 45 })
              .attr('y', function(d) { return d.y - 4; })
              .text(function(d) {
                if (d.alpha == null || d.beta == null) { return '' };
                return "α: " + d.alpha.toString().replace('Infinity', '∞');
              });
            vertex.select('text.beta')
              .attr('x', function(d) { return d.x + 45 })
              .attr('y', function(d) { return d.y + 16; })
              .text(function(d) {
                if (d.alpha == null || d.beta == null) { return '' };
                return "β: " + d.beta.toString().replace('Infinity', '∞');
              });
            // update existing cursor
            vertex.select('rect.cursor')
              .attr('x', function(node) {
                var nodeVal = node.value;
                var valStr = (nodeVal == null) ? '' : nodeVal.toString();

                var valSVG = d3.select(this.parentNode).select('text').node();
                var valSVGLength = valSVG ? valSVG.getComputedTextLength() : 0;

                var subStrLength = computeTextWidth(
                    valStr.substring(0, valCharIndex),
                    "18px Helvetica Neue"
                );

                return node.x + (subStrLength - (valSVGLength / 2));
              })
              .attr('y', function(node) {
                return node.y - 9;
              });
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

              scope.reRender();
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
                d3.event.preventDefault();
                decrValCharIndex();
              } else if (lastKeyDown == 39) {  // right arrow
                d3.event.preventDefault();
                incrValCharIndex();
              } else if (lastKeyDown == 13) {  // enter
                parseAndSetNodeValue();
              } else if (lastKeyDown == 27) {  // escape
                discardNodeValueChanges();
              }
              scope.reRender();
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
        });
       });
      },
    };
  }]);
