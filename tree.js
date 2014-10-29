Array.prototype.extend = function(array) {
  Array.prototype.push.apply(this, array);
}

var treeNodeTypeEnum = {
  maxNode: 'maxNode',
  minNode: 'minNode',
  randNode: 'randNode',
  leafNode: 'leafNode',
}


function Tree(depth, branchingFactor, treeType, rootNode) {
  this.depth = depth;
  this.branchingFactor = branchingFactor;
  this.treeType = treeType;
  this.rootNode = rootNode;
}
Tree.prototype.alphaBeta = function() {
  var thisTree = this;
  var generatePruneActionList = function(node, bFac) {
    actions = [];
    var pruneInner = function(node, bFac, actions) {
      if (!node) { return; }

      if (node.parentLink) {
        actions.push(new Action(node.parentLink, 'pruned', false, true));
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
      new Action(node.parentLink, 'entered', false, true),
      new Action(node, 'entered', false, true),
    ];
    var childActionsList = [];

    if (node.nodeType == treeNodeTypeEnum.leafNode) {
      return {
        returnVal: node.value,
        enterActions: enterActions,
        childActionsList: childActionsList,
        exitActions: [new Action(node.parentLink, 'entered', true, false)],
      };
    }

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
            console.log(res.returnVal + " > " + curVal);
            curVal = res.returnVal;
            setValActions.push(new Action(node, 'value', node.__abValue, curVal));
            node.__abValue = curVal;
          }
          if (res.returnVal > a) {
            a = res.returnVal;
            setValActions.extend([
              new Action(thisTree, 'alpha', thisTree.alpha, a),
              new Action(thisTree, 'beta', thisTree.beta, b),
            ]);
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
            console.log(res.returnVal + " < " + curVal);
            curVal = res.returnVal;
            setValActions.push(new Action(node, 'value', node.__abValue, curVal));
            node.__abValue = curVal;
          }
          if (res.returnVal < b) {
            b = res.returnVal;
            setValActions.extend([
              new Action(thisTree, 'alpha', thisTree.alpha, a),
              new Action(thisTree, 'beta', thisTree.beta, b),
            ]);
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
      new Action(node.parentLink, 'entered', true, false),
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
  res.enterActions.extend([
    new Action(thisTree, 'alpha', null, Number.NEGATIVE_INFINITY),
    new Action(thisTree, 'beta', null, Number.POSITIVE_INFINITY),
  ]);
  actionLQ.pushActionList(res.enterActions);
  actionLQ.extendActionList(res.childActionsList);
  actionLQ.pushActionList(res.exitActions);
  return actionLQ;
}


function TreeNode(depth, nodeType, childNum, parentNode) {
  this.nodeType = nodeType;
  this.parentNode = parentNode;
  this.edgeToParent = null;
  this.childNum = childNum;
  this.depth = depth;
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
}
ActionListQueue.prototype.pushActionList = function(actionList) {
  if (this.inAction) { throw "Cannot push action list while queue is active"; }
  this.actionListQueue.push(actionList);
}
ActionListQueue.prototype.extendActionList = function(actionLists) {
  if (this.inAction) { throw "Cannot push action list while queue is active"; }
  this.actionListQueue.extend(actionLists);
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
ActionListQueue.prototype.playThrough = function() {
  this.inAction = true;
  while (this.stepForward()) {}
  this.inAction = false;
}
ActionListQueue.prototype.revertToBeginning = function() {
  this.inAction = true;
  while (this.stepBackward()) {}
  this.inAction = false;
}
