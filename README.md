Remembrall is an interactive splay tree visualization tool with an analogy in relation to memory. It turns standard splay tree operations into actions like encoding, recalling, forgetting, merging, and partitioning memories, so users can explore how splay trees work in a more intuitive way.

Encoding occurs by associating a memory with a certain key. This key can represent memory importance or the age at which the memory is made (there would be a lot of ties in this case)!

To run this project:
Install dependencies with npm install
Start the development server with npm run dev

After the running the project, the website has a control bar. You can do different operations on splay trees by adding a memory or deleting a memory or splitting a joined memory group into two seperate groups, where each operation has its own color associated with it. If a user really wants to get an indepth understanding of the operation, they can decrease the animation speed to really see what is happening. 
There are also default splay trees provided to do the merge operation. We have the memories related to academics and another memory group related to activities on campus and when both of these splay trees are merged, we get one splay tree reperesenting college memories. 
When visualizing the different operations, the captions can help to understand what's actually happening. Through this, they can see the different zig cases that relate to splay trees depending on the key of the memory that they're trying to encode

The display of the splay tree only includes the keys on the nodes. However, if a user wants to see the memory that's encoded within that node, they can click on a node and get the details (value) of the key. 
