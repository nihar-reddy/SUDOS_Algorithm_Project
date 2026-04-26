from city_graph import CityMap
from algo_greedy import greedy_tsp
from algo_dp_optimal import dp_bitmask_tsp
from algo_floyd_warshall import floyd_warshall
from algo_max_flow import max_flow_assignment

def run_sudos_backend():
    print("==========================================")
    print("   SUDOS Python Algorithm Engine Tester   ")
    print("==========================================\n")
    
    # 1. Initialize Graph
    city = CityMap()
    
    # 2. Add sample roads
    city.add_road('W', '1', 10)
    city.add_road('W', '2', 15)
    city.add_road('1', 'C1', 5)
    city.add_road('2', 'C2', 8)
    city.add_road('1', '2', 7)
    
    warehouse = 'W'
    customers = ['C1', 'C2']
    num_agents = 3

    print(f"Warehouse Location: {warehouse}")
    print(f"Customer Locations: {customers}")
    print(f"Agents Available: {num_agents}\n")
    print("--- Running Algorithms ---\n")

    # Greedy
    path, cost = greedy_tsp(city, warehouse, customers)
    print(f"1. Greedy TSP Route: {path} | Distance: {cost}km")

    # DP Bitmask
    optimal_cost = dp_bitmask_tsp(city, warehouse, customers)
    print(f"2. Optimal DP Bitmask Distance: {optimal_cost}km")

    # Floyd-Warshall
    dist_matrix, next_nodes = floyd_warshall(city)
    print(f"3. Floyd-Warshall APSP Matrix generated successfully.")

    # Max Flow
    capacity, dispatched = max_flow_assignment(city, warehouse, customers, num_agents)
    print(f"4. Max Flow / Network Assignment: Dispatched {dispatched} agents with total capacity {capacity}.")
    print("\n==========================================")

if __name__ == "__main__":
    run_sudos_backend()