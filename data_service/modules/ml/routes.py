"""
modules/ml — Machine Learning Model Management and Signals
Placeholder module: will be expanded with ML model registry, signal generation,
training monitoring, and regime detection.
"""

from flask import Blueprint, jsonify
from datetime import datetime

bp = Blueprint('ml', __name__, url_prefix='/api')


@bp.route('/ml/status')
def ml_status():
    return jsonify({
        'module': 'ml',
        'status': 'placeholder',
        'message': 'ML module ready for implementation. Will contain model registry, signal engine, training monitor.',
        'lastUpdated': datetime.utcnow().isoformat() + 'Z',
    })
