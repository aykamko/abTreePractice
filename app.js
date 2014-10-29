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

    $scope.reRender = function() { return; }
    $scope.actionLQ = null;
    $scope.alphaBeta = function() {
      window.a = $scope.actionLQ = $scope.tree.alphaBeta();
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

  }])
  .directive('abTree', ['NodeEnum', 'd3Service', function(NodeEnum, d3Service) {
    return {
      restrict: 'E',
      scope: {
        tree: '=',
        reRender: '=',
      },
      link: function(scope, element, attrs) {
        var svgWidth = 1200,
            svgHeight = 800,
            svgMargin = 40,
            nodeSideLength = 80,
            triNodeHeight = Math.sqrt(Math.pow(nodeSideLength, 2) -
                Math.pow((nodeSideLength/2), 2)),
            triCenterFromBaseDist = Math.sqrt(
                Math.pow((nodeSideLength / Math.sqrt(3)), 2) -
                Math.pow((nodeSideLength / 2),2));

        d3Service.d3().then(function(d3) {
          var colors = d3.scale.category10();

          var svg = d3.select(element[0])
            .append('svg')
            .attr('width', svgWidth)
            .attr('height', svgHeight);

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
                var link = {source: curNode.parentNode, target: curNode}
                curNode.parentLink = link;
                links.push(link);
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

            // add new links
            var newLinks = path.enter().append('svg:g');
            newLinks.append('svg:path')
              .attr('class', 'link')
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
                d.pruned = !d.pruned;
                restart();
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
              .classed('pruned', function(d) { return d.pruned; })
              .classed('entered', function(d) {
                console.log(this);
                console.log(d);
                return d.entered;
              });

            // vertex (node) group
            // NB: the function arg is crucial here! nodes are known by id, not by index!
            vertex = vertex.data(nodes, function(d) { return d.id; });

            // add new nodes
            var g = vertex.enter().append('svg:g')
              .classed('node', true)
              .classed('leaf', function(d) {
                return (d.nodeType == NodeEnum.leafNode);
              });

            g.append('svg:path')
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
              })
              .style('stroke', function(d) { return 'black'; })
              .on('mousedown', function(d) {
                // select node
                if (d.nodeType == NodeEnum.leafNode) { return; }
                mousedownNode = d;
                d.oldVal = d.value;
                restart();
              });

            // show node IDs
            g.append('svg:text')
              .attr('class', 'value')

            // remove old nodes
            vertex.exit().remove();

            vertex
              .classed('entered', function(d) { return d.entered; });

            // update existing node values
            vertex.select('text.value')
              .attr('x', function(d) { return d.x })
              .attr('y', function(d) {
                return d.y + 6;
              })
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
          };
          scope.reRender = restart;

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
        });
      },
    };
  }]);
