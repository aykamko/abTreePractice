function Tree(depth, branchingFactor, treeType, rootNode) {
  this.depth = depth;
  this.branchingFactor = branchingFactor;
  this.treeType = treeType;
  this.rootNode = rootNode;
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
