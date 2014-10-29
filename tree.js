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
  var prune = function(node, bFac) {
    if (!node) { return; }

    if (node.parentLink) {
      node.parentLink.pruned = true;
    }
    var child;
    for (var k = 0; k < bFac; k++) {
      child = node.getKthChild(k);
      prune(child, bFac);
    }
  }

  var abInner = function(node, bFac, a, b, maxNode) {
    if (node.nodeType == treeNodeTypeEnum.leafNode) { return node.value; }

    var k = 0;
    var child;
    var pruneRest = false;
    if (maxNode) {
      for (; k < bFac; k++) {
        child = node.getKthChild(k);
        if (pruneRest) {
          prune(child, bFac);
        } else {
          a = Math.max(a, abInner(child, bFac, a, b, !maxNode));
          if (b <= a) {
            pruneRest = true;
          }
        }
      }
      node.value = a;
      return a;
    } else {
      for (; k < bFac; k++) {
        child = node.getKthChild(k);
        if (pruneRest) {
          prune(child, bFac);
        } else {
          b = Math.min(b, abInner(child, bFac, a, b, !maxNode));
          if (b <= a) {
            pruneRest = true;
          }
        }
      }
      node.value = b;
      return b;
    }

  }
  this.rootNode.value = abInner(this.rootNode, this.branchingFactor,
      Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY,
      (this.treeType == treeNodeTypeEnum.maxNode));
  return this.rootNode.value;
}

function TreeNode(depth, nodeType, childNum, parentNode) {
  this.nodeType = nodeType;
  this.parentNode = parentNode;
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
