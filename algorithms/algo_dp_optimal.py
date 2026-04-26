def dp_bitmask_tsp(city_map, start_node, targets):
    matrix, node_map = city_map.get_adjacency_matrix()
    
    target_indices = [node_map[t] for t in targets]
    start_idx = node_map[start_node]
    
    R = [start_idx] + target_indices
    n = len(R)
    
    dp = [[float('inf')] * n for _ in range(1 << n)]
    dp[1][0] = 0 

    for mask in range(1 << n):
        for u in range(n):
            if mask & (1 << u):
                for v in range(n):
                    if not (mask & (1 << v)):
                        nxt_mask = mask | (1 << v)
                        cost = matrix[R[u]][R[v]]
                        if dp[mask][u] + cost < dp[nxt_mask][v]:
                            dp[nxt_mask][v] = dp[mask][u] + cost

    full_mask = (1 << n) - 1
    min_cost = min(dp[full_mask][i] for i in range(1, n))
    
    return min_cost