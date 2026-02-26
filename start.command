#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     DIBREVA Mini ERP v1.0            ║"
echo "  ║     Manutenção & Restauração Predial ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Abrindo CRM no navegador..."
echo "  Servidor: http://localhost:8080"
echo "  Para parar: Ctrl+C"
echo ""
open http://localhost:8080/crm.html
python3 -m http.server 8080
