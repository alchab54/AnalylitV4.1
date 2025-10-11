#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resource Monitor pour AnalyLit V4.1
Monitore l'utilisation CPU, RAM, GPU (RTX 2060 SUPER)
"""

import time
import psutil
import logging
from datetime import datetime

# Configuration du logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def get_system_info():
    """Récupère les informations système"""
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        
        # RAM
        ram = psutil.virtual_memory()
        ram_percent = ram.percent
        ram_used_gb = ram.used / (1024**3)
        ram_total_gb = ram.total / (1024**3)
        
        # Disque
        disk = psutil.disk_usage('/')
        disk_percent = (disk.used / disk.total) * 100
        disk_free_gb = disk.free / (1024**3)
        
        return {
            "timestamp": datetime.now().isoformat(),
            "cpu_percent": cpu_percent,
            "cpu_count": cpu_count,
            "ram_percent": ram_percent,
            "ram_used_gb": round(ram_used_gb, 2),
            "ram_total_gb": round(ram_total_gb, 2),
            "disk_percent": round(disk_percent, 2),
            "disk_free_gb": round(disk_free_gb, 2)
        }
    except Exception as e:
        logger.error(f"Erreur récupération système : {e}")
        return None

def main():
    """Monitoring principal"""
    logger.info("🚀 AnalyLit Resource Monitor démarré")
    
    try:
        while True:
            system_info = get_system_info()
            if system_info:
                logger.info(f"📊 CPU: {system_info['cpu_percent']}% | "
                          f"RAM: {system_info['ram_percent']}% ({system_info['ram_used_gb']}/{system_info['ram_total_gb']}GB) | "
                          f"Disk: {system_info['disk_percent']}% ({system_info['disk_free_gb']}GB free)")
            
            time.sleep(30)  # Monitoring toutes les 30 secondes
            
    except KeyboardInterrupt:
        logger.info("🛑 Monitor arrêté")
    except Exception as e:
        logger.error(f"💥 Erreur monitor : {e}")

if __name__ == "__main__":
    main()
