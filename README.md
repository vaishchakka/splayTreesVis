# Remembrall

Remembrall is an interactive splay tree visualization tool that uses a memory analogy. It turns standard splay tree operations into actions like encoding, recalling, forgetting, merging, and partitioning memories so users can explore how splay trees work in a more intuitive way.

Encoding happens by associating a memory with a certain key. This key can represent memory importance or the age at which the memory was made.

## Running the project

- Install dependencies with `npm install`
- Start the development server with `npm run dev`

## Using the visualizer

After running the project, the website shows a control bar where users can perform different splay tree operations, such as adding a memory, deleting a memory, or splitting a joined memory group into two separate groups.

Each operation has its own associated color. If a user wants a more detailed understanding of what is happening, they can decrease the animation speed to watch the operation more closely.

There are also default splay trees provided for the merge operation. One memory group is related to academics, and another is related to campus activities. When these two splay trees are merged, they form one splay tree representing college memories.

The captions during each operation help explain what is happening in the visualization. Through this, users can observe the different zig cases involved in splay tree operations depending on the key of the memory they are working with.

The tree display only shows keys on the nodes. However, if a user wants to see the memory stored in a node, they can click on it to view the details associated with that key.
