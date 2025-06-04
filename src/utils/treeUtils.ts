import type { FragmentsModel } from '@thatopen/fragments';

export interface TreeNode {
  key: string;
  label: string;
  children: TreeNode[];
}

export const loadTreeData = async (
  fragmentModel: FragmentsModel,
  categories?: string[]
): Promise<TreeNode[]> => {
  if (!fragmentModel) return [];

  try {
    // Get spatial structure elements
    const spatialElements = await fragmentModel.getSpatialStructure();
    if (spatialElements) {
      // Transform the data into a tree structure
      const transformNode = (rootNode: any): TreeNode[] => {
        interface StackItem {
          node: any;
          result: TreeNode | null;
          parentLabel?: string;
        }
        const stack: StackItem[] = [{ node: rootNode, result: null }];
        const resultMap = new Map<string, TreeNode>();

        while (stack.length > 0) {
          const current = stack.pop();
          if (!current) continue;

          const { node, result, parentLabel } = current;

          // If node has no localId, just pass its label to children
          if (!node.localId) {
            if (node.children && node.children.length > 0) {
              // Push children to stack with parent's label
              for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push({
                  node: node.children[i],
                  result: result,
                  parentLabel: node.category || parentLabel,
                });
              }
            }
            continue;
          }

          const transformedNode: TreeNode = {
            key: `${node.localId}`,
            label: `${node.category || parentLabel} (id: ${node.localId})`,
            children: [],
          };

          if (result) {
            result.children.push(transformedNode);
          } else {
            resultMap.set(node.localId, transformedNode);
          }

          if (node.children && node.children.length > 0) {
            // Push children to stack in reverse order to maintain original order
            for (let i = node.children.length - 1; i >= 0; i--) {
              stack.push({
                node: node.children[i],
                result: transformedNode,
                parentLabel: node.category || parentLabel,
              });
            }
          }
        }

        return Array.from(resultMap.values());
      };

      const treeData = transformNode(spatialElements);

      // Apply category filter if categories are provided
      if (categories && categories.length > 0) {
        return filterTreeByCategories(treeData, categories);
      }

      return treeData;
    }
  } catch (error) {
    console.error('Error loading tree data:', error);
  }

  return [];
};

/**
 * Filters tree nodes by categories while preserving parent nodes that have matching descendants
 */
const filterTreeByCategories = (nodes: TreeNode[], categories: string[]): TreeNode[] => {
  const filterNode = (node: TreeNode): TreeNode | null => {
    // First, recursively filter children
    const filteredChildren = node.children
      .map((child) => filterNode(child))
      .filter((child): child is TreeNode => child !== null);

    // Extract category from label (format: "Category (id: localId)")
    const categoryMatch = node.label.match(/^([^(]+)/);
    const nodeCategory = categoryMatch ? categoryMatch[1].trim() : '';

    // Check if this node's category matches the filter
    const categoryMatches = categories.some((cat) =>
      nodeCategory.toLowerCase().includes(cat.toLowerCase())
    );

    // Keep the node if:
    // 1. It has filtered children (parent node with matching descendants)
    // 2. OR it matches the category filter itself
    if (filteredChildren.length > 0 || categoryMatches) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    // Remove this node if it doesn't match and has no matching descendants
    return null;
  };

  return nodes.map((node) => filterNode(node)).filter((node): node is TreeNode => node !== null);
};
