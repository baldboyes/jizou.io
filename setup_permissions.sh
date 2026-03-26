#!/bin/bash

API_URL="${DIRECTUS_URL:-https://directus.jizou.io}"
TOKEN="${DIRECTUS_ADMIN_TOKEN:-}"
POLICY_ID="${DIRECTUS_POLICY_ID:-6b3a4f9f-b921-4345-930d-1d8964f572fd}"

if [ -z "$TOKEN" ]; then
  echo "Falta DIRECTUS_ADMIN_TOKEN en el entorno."
  exit 1
fi

# Función para crear permiso
create_permission() {
  local COLLECTION="$1"
  local ACTION="$2"
  local PERMISSIONS="$3"
  
  echo "Setting $ACTION permission for $COLLECTION..."
  
  # Check if permission already exists (optional, but good practice to avoid duplicates if re-run)
  # For simplicity, we just try to create. Directus might return error if unique constraint violated, 
  # but since we are migrating to new collections, they should be empty of permissions.
  
  curl -s -X POST "$API_URL/permissions" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"policy\": \"$POLICY_ID\",
      \"collection\": \"$COLLECTION\",
      \"action\": \"$ACTION\",
      \"permissions\": $PERMISSIONS,
      \"fields\": [\"*\"]
    }" | jq '.data.id'
}

echo "🚀 Configurando permisos para la Política 'App User' ($POLICY_ID)..."

# ==========================================
# 1. TRIPS (Viajes)
# ==========================================

# READ: Creador O Colaborador
# Nota: La lógica OR en permisos de Directus se hace con _or
TRIP_READ_RULE='{
  "_or": [
    { "user_created": { "_eq": "$CURRENT_USER" } },
    { "collaborators": { "_some": { "directus_user_id": { "_eq": "$CURRENT_USER" } } } }
  ]
}'
create_permission "trips" "read" "$TRIP_READ_RULE"

# CREATE: Permitido
create_permission "trips" "create" "{}"

# UPDATE: Creador O Colaborador
create_permission "trips" "update" "$TRIP_READ_RULE"

# DELETE: Solo Creador
create_permission "trips" "delete" '{ "user_created": { "_eq": "$CURRENT_USER" } }'


# ==========================================
# 2. COLLECTIONS DEPENDIENTES (Expenses, Activities, etc.)
# ==========================================
# Regla común:
# - Soy el creador del ítem
# - O soy colaborador del viaje asociado
# - O soy el creador del viaje asociado (dueño del viaje)

DEPENDENT_READ_RULE='{
  "_or": [
    { "user_created": { "_eq": "$CURRENT_USER" } },
    { "trip_id": { "collaborators": { "_some": { "directus_user_id": { "_eq": "$CURRENT_USER" } } } } },
    { "trip_id": { "user_created": { "_eq": "$CURRENT_USER" } } }
  ]
}'

DEPENDENT_READ_RULE_NO_ITEM_USER_CREATED='{
  "_or": [
    { "trip_id": { "collaborators": { "_some": { "directus_user_id": { "_eq": "$CURRENT_USER" } } } } },
    { "trip_id": { "user_created": { "_eq": "$CURRENT_USER" } } }
  ]
}'

# Lista de colecciones dependientes de trip_id
COLLECTIONS=(
  "expenses"
  "activities"
  "accommodations"
  "transports"
  "flights"
  "daily_notes"
  "currency_exchanges"
  "insurances"
  "tasks"
)

for COL in "${COLLECTIONS[@]}"; do
  # READ
  if [ "$COL" = "tasks" ]; then
    create_permission "$COL" "read" "$DEPENDENT_READ_RULE_NO_ITEM_USER_CREATED"
  else
    create_permission "$COL" "read" "$DEPENDENT_READ_RULE"
  fi
  
  # CREATE - Permitido (se asigna al usuario actual automáticamente)
  create_permission "$COL" "create" "{}"
  
  # UPDATE - Misma regla que Read (Colaboradores pueden editar)
  if [ "$COL" = "tasks" ]; then
    create_permission "$COL" "update" "$DEPENDENT_READ_RULE_NO_ITEM_USER_CREATED"
  else
    create_permission "$COL" "update" "$DEPENDENT_READ_RULE"
  fi
  
  # DELETE - Solo el creador del ítem O el dueño del viaje
  if [ "$COL" = "tasks" ]; then
    create_permission "$COL" "delete" '{ "trip_id": { "user_created": { "_eq": "$CURRENT_USER" } } }'
  else
    DELETE_RULE='{
      "_or": [
        { "user_created": { "_eq": "$CURRENT_USER" } },
        { "trip_id": { "user_created": { "_eq": "$CURRENT_USER" } } }
      ]
    }'
    create_permission "$COL" "delete" "$DELETE_RULE"
  fi
done

# ==========================================
# 3. NOTIFICATIONS
# ==========================================
# Solo ver las propias
NOTIF_RULE='{ "recipient_id": { "_eq": "$CURRENT_USER" } }'
create_permission "notifications" "read" "$NOTIF_RULE"
create_permission "notifications" "update" "$NOTIF_RULE"
# Create: Normalmente sistema, pero permitimos al usuario por si acaso
create_permission "notifications" "create" '{ "recipient_id": { "_eq": "$CURRENT_USER" } }' 
create_permission "notifications" "delete" "$NOTIF_RULE"

echo "✅ Permisos configurados exitosamente."
