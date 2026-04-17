def greedy_tsp(city_map, start_node, target_nodes):
    visited = {start_node}
    current = start_node
    total_cost = 0
    path = [start_node]
    targets = set(target_nodes)

    while targets:
        nearest = None
        min_dist = float('inf')
        
        for v, weight in city_map.adj_list[current]:
            if v not in visited and weight < min_dist:
                min_dist = weight
                nearest = v

        if nearest is None:
            break 
            
        visited.add(nearest)
        path.append(nearest)
        total_cost += min_dist
        
        if nearest in targets:
            targets.remove(nearest)
        current = nearest

    return path, total_cost