from collections import defaultdict

class CityMap:
    def __init__(self):
        self.nodes = set()
        self.adj_list = defaultdict(list)
        self.edges = []

    def add_location(self, node_id):
        self.nodes.add(node_id)

    def add_road(self, u, v, distance, is_directed=False):
        self.nodes.update([u, v])
        self.edges.append({'u': u, 'v': v, 'cap': distance})
        self.adj_list[u].append((v, distance))
        if not is_directed:
            self.adj_list[v].append((u, distance))

    def get_adjacency_matrix(self):
        n = len(self.nodes)
        node_map = {node: i for i, node in enumerate(self.nodes)}
        matrix = [[float('inf')] * n for _ in range(n)]
        
        for i in range(n):
            matrix[i][i] = 0
            
        for u in self.adj_list:
            for v, w in self.adj_list[u]:
                matrix[node_map[u]][node_map[v]] = w
                
        return matrix, node_map