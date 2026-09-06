from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from .rules import evaluate_scheme
from .providers import official_url


class State(TypedDict, total=False):
    profile: dict
    confirmed: list[str]
    schemes: list[dict]
    results: list[dict]
    trajectory: list[str]


def build_graph(checkpointer=None):
    def validate(state):
        if not set(state['confirmed']).issubset(state['profile']):
            raise ValueError('Confirmed fields must exist in the profile.')
        return {'trajectory': ['validate_confirmed_profile']}

    def rules(state):
        return {'results': [evaluate_scheme(s, state['profile'], state['confirmed']) for s in state['schemes']], 'trajectory': state['trajectory'] + ['deterministic_rules']}

    def verify(state):
        results = []
        for result in state['results']:
            if any(not official_url(r['source']) for r in result['reasons']):
                result = {**result, 'status': 'UNABLE_TO_DETERMINE', 'notice': 'Evidence validation failed.'}
            results.append(result)
        return {'results': results, 'trajectory': state['trajectory'] + ['verify_citations']}

    def prepare(state):
        return {'trajectory': state['trajectory'] + ['prepare_response']}

    graph = StateGraph(State)
    for name, node in [('validate', validate), ('rules', rules), ('verify', verify), ('prepare', prepare)]:
        graph.add_node(name, node)
    graph.add_edge(START, 'validate')
    graph.add_edge('validate', 'rules')
    graph.add_edge('rules', 'verify')
    graph.add_edge('verify', 'prepare')
    graph.add_edge('prepare', END)
    return graph.compile(checkpointer=checkpointer)
