def floyd_warshall(city_map):
    matrix, node_map = city_map.get_adjacency_matrix()
    n = len(matrix)
    
    dist = [row[:] for row in matrix]
    next_node = [[None] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if matrix[i][j] != float('inf') and i != j:
                next_node[i][j] = j

    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dist[i][k] + dist[k][j] < dist[i][j]:
                    dist[i][j] = dist[i][k] + dist[k][j]
                    next_node[i][j] = next_node[i][k]

    return dist, next_node