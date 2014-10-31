function computeTextWidth(text, font) {
  // re-use canvas object for better performance
  var canvas = computeTextWidth.canvas || (computeTextWidth.canvas = document.createElement("canvas"));
  var context = canvas.getContext("2d");
  context.font = font;
  var metrics = context.measureText(text);
  return metrics.width;
};

Array.prototype.extend = function(array) {
  Array.prototype.push.apply(this, array);
}

var treeNodeTypeEnum = {
  maxNode: 'maxNode',
  minNode: 'minNode',
  randNode: 'randNode',
  leafNode: 'leafNode',

  opposite: function(t) {
    if (t == this.maxNode) {
      return this.minNode;
    } else if (t == this.minNode) {
      return this.maxNode;
    }
    return t;
  },
}

function Tree(rootNode, treeType, depth, branchingFactor) {
  this.rootNode = rootNode;
  this.treeType = treeType;
  this.depth = depth;
  this.branchingFactor = branchingFactor;
  this.mutable = true;
}
Tree.generateABTreeRootNode = function(treeType, maxDepth, branchingFactor, minVal, maxVal) {
  function generateSubTree(parentNode, nodeType, depth, bFac) {
    var curNode = new TreeNode(nodeType, parentNode, depth, bFac);
    if (depth == maxDepth) {
      curNode.nodeType = treeNodeTypeEnum.leafNode;
      curNode.value = Math.round(Math.random() * (maxVal - minVal)) - maxVal;
    } else {
      for (var k = 0; k < bFac; k++) {
        curNode.setKthChild(k,
          generateSubTree(
            curNode,
            treeNodeTypeEnum.opposite(nodeType),
            depth + 1,
            bFac
          )
        );
      }
    }
    return curNode;
  }
  return generateSubTree(null, treeType, 1, branchingFactor);
}
Tree.prototype.alphaBeta = function() {
  var thisTree = this;
  var generatePruneActionList = function(node, bFac) {
    actions = [];
    var pruneInner = function(node, bFac, actions) {
      if (!node) { return; }

      if (node.edgeToParent) {
        actions.push(new Action(node.edgeToParent, 'pruned', false, true));
        node.edgeToParent.__pruned = true;
      }
      var child;
      for (var k = 0; k < bFac; k++) {
        child = node.getKthChild(k);
        pruneInner(child, bFac, actions);
      }
    }
    pruneInner(node, bFac, actions);
    return actions;
  }

  var abActions = function(node, bFac, a, b, maxNode, actionLQ) {
    var enterActions = [
      new Action(node.edgeToParent, 'entered', false, true),
      new Action(node, 'entered', false, true),
    ];
    var childActionsList = [];

    if (node.nodeType == treeNodeTypeEnum.leafNode) {
      return {
        returnVal: node.value,
        enterActions: enterActions,
        childActionsList: childActionsList,
        exitActions: [new Action(node.edgeToParent, 'entered', true, false)],
      };
    }

    enterActions.extend([
      new Action(node, 'alpha', node.alpha, a),
      new Action(node, 'beta', node.beta, b),
    ]);
    node.__alpha = a;
    node.__beta = b;

    var k = 0,
        pruneRest = false,
        lastChildExitActions = [],
        curVal = maxNode ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
        child,
        childVal,
        setValActions,
        res;
    if (maxNode) {
      for (; k < bFac; k++) {
        child = node.getKthChild(k);
        if (pruneRest) {
          lastChildExitActions.extend(generatePruneActionList(child, bFac));
        } else {
          res = abActions(child, bFac, a, b, !maxNode, actionLQ);
          setValActions = [];
          if (res.returnVal > curVal) {
            curVal = res.returnVal;
            setValActions.push(new Action(node, 'value', node.__value, curVal));
            node.__value = curVal;
          }
          if (res.returnVal > a) {
            a = res.returnVal;
            setValActions.extend([
              new Action(node, 'alpha', node.__alpha, a),
            ]);
            node.__alpha = a;
          }
          if (res.childActionsList.length) {
            res.exitActions.extend(setValActions);
          } else {
            res.enterActions.extend(setValActions);
          }
          res.enterActions.extend(lastChildExitActions);
          childActionsList.push(res.enterActions);
          childActionsList.extend(res.childActionsList);
          lastChildExitActions = res.exitActions;
          if (b <= a) {
            pruneRest = true;
          }
        }
      }
    } else {
      for (; k < bFac; k++) {
        child = node.getKthChild(k);
        if (pruneRest) {
          lastChildExitActions.extend(generatePruneActionList(child, bFac));
        } else {
          res = abActions(child, bFac, a, b, !maxNode, actionLQ);
          setValActions = [];
          if (res.returnVal < curVal) {
            curVal = res.returnVal;
            setValActions.push(new Action(node, 'value', node.__value, curVal));
            node.__value = curVal;
          }
          if (res.returnVal < b) {
            b = res.returnVal;
            setValActions.extend([
              new Action(node, 'beta', node.__beta, b),
            ]);
            node.__beta = b;
          }
          if (res.childActionsList.length) {
            res.exitActions.extend(setValActions);
          } else {
            res.enterActions.extend(setValActions);
          }
          res.enterActions.extend(lastChildExitActions);
          childActionsList.push(res.enterActions);
          childActionsList.extend(res.childActionsList);
          lastChildExitActions = res.exitActions;
          if (b <= a) {
            pruneRest = true;
          }
        }
      }
    }
    childActionsList.push(lastChildExitActions);
    var exitActions = [
      new Action(node.edgeToParent, 'entered', true, false),
      new Action(node, 'entered', true, false),
    ];

    return {
      returnVal: curVal,
      enterActions: enterActions,
      childActionsList: childActionsList,
      exitActions: exitActions,
    };
  }
  var actionLQ = new ActionListQueue();
  var res = abActions(
    this.rootNode,
    this.branchingFactor,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    (this.treeType == treeNodeTypeEnum.maxNode)
  );
  actionLQ.pushActionList(res.enterActions);
  actionLQ.extendActionList(res.childActionsList);
  actionLQ.pushActionList(res.exitActions);
  return actionLQ;
}
Tree.prototype.checkAnswer = function() {
  function checkSubTree(node) {
    if (node.nodeType == treeNodeTypeEnum.leafNode) { return true; }
    if (node.value != node.__value) {
      return false;
    }
    if (node.edgeToParent &&
        node.edgeToParent.__pruned &&
        node.edgeToParent.__pruned != node.edgeToParent.pruned) {
      return false;
    }
    var res = true;
    for (var k = 0; k < node.childNum; k++) {
      res = res && checkSubTree(node.getKthChild(k));
    }
    return res;
  }
  return checkSubTree(this.rootNode);
}
Tree.prototype.reset = function() {
  function resetSubTree(node) {
    if (node.edgeToParent) {
      node.edgeToParent.entered = false;
      node.edgeToParent.pruned = false;
    }
    node.entered = false;
    if (node.nodeType == treeNodeTypeEnum.leafNode) { return; }
    node.value = null;
    node.alpha = null;
    node.beta = null;
    for (var k = 0; k < node.childNum; k++) {
      resetSubTree(node.getKthChild(k));
    }
  }
  resetSubTree(this.rootNode);
}
Tree.prototype.setSolution = function() {
  this.alphaBeta();
  function setSolutionForSubTree(node) {
    if (node.edgeToParent) {
      node.edgeToParent.pruned = node.edgeToParent.__pruned;
    }
    if (node.nodeType == treeNodeTypeEnum.leafNode) { return; }
    node.value = node.__value;
    node.alpha = node.__alpha;
    node.beta = node.__beta;
    for (var k = 0; k < node.childNum; k++) {
      setSolutionForSubTree(node.getKthChild(k));
    }
  }
  setSolutionForSubTree(this.rootNode);
}


function TreeNode(nodeType, parentNode, depth, childNum) {
  this.nodeType = nodeType;
  this.setParent(parentNode);
  this.depth = depth;
  this.childNum = childNum;
  this.children = new Array(childNum);
  this.value = null;
}
TreeNode.prototype.setKthChild = function(k, child) {
  if (k >= this.childNum) {
    throw "Error: node only holds " + k + " children."
  }
  this.children[k] = child;
}
TreeNode.prototype.getKthChild = function(k) {
  if (k >= this.childNum) {
    throw "Error: node only holds " + k + " children."
  }
  return this.children[k];
}
TreeNode.prototype.setParent = function(parentNode) {
  if (parentNode) {
    this.edgeToParent = new TreeEdge(parentNode, this);
    this.parentNode = parentNode;
  }
}

function TreeEdge(source, target) {
  this.source = source;
  this.target = target;
  this.pruned = false;
}

function Action(object, key, oldVal, newVal) {
  this.object = object;
  this.key = key;
  this.oldVal = oldVal;
  this.newVal = newVal;
}
Action.prototype.apply = function() {
  if (!this.object) { return; }
  this.object[this.key] = this.newVal;
}
Action.prototype.reverse = function() {
  if (!this.object) { return; }
  this.object[this.key] = this.oldVal;
}


function ActionListQueue() {
  this.inAction = false;
  this.lastAction = -1;
  this.actionListQueue = []
  this.length = 0;
}
ActionListQueue.prototype.pushActionList = function(actionList) {
  if (this.inAction) { throw "Cannot push action list while queue is active"; }
  this.actionListQueue.push(actionList);
  this.length += 1;
}
ActionListQueue.prototype.extendActionList = function(actionLists) {
  if (this.inAction) { throw "Cannot push action list while queue is active"; }
  this.actionListQueue.extend(actionLists);
  this.length += actionLists.length;
}
ActionListQueue.prototype.stepForward = function() {
  if (!this.inAction ||
      this.lastAction == (this.actionListQueue.length - 1)) {
    return false;
  }
  this.lastAction += 1;
  var actionList = this.actionListQueue[this.lastAction];
  var a;
  for (var i = 0; i < actionList.length; i++) {
    a = actionList[i];
    a.apply();
  }
  return true;
}
ActionListQueue.prototype.stepBackward = function() {
  if (!this.inAction || this.lastAction == -1) {
    return false;
  }
  var actionList = this.actionListQueue[this.lastAction];
  var a;
  for (var i = 0; i < actionList.length; i++) {
    a = actionList[i];
    a.reverse();
  }
  this.lastAction -= 1;
  return true;
}
ActionListQueue.prototype.goToEnd = function() {
  if (!this.inAction) { return; }
  while (this.stepForward()) {}
}
ActionListQueue.prototype.goToBeginning = function() {
  if (!this.inAction) { return; }
  while (this.stepBackward()) {}
}
ActionListQueue.prototype.play = function() {
  if (!this.inAction) { return; }
  var end = false;
  var time = 300;
  var step = function(aq) {
    var res = aq.stepForward();
    if (res) {
      setTimeout(step.bind(aq));
    }
  };
  step(this);
}
ActionListQueue.prototype.pause = function() {
  clearTimeout(this.playTimeout);
}
