import { supabase } from './supabase'
import { fetchProducts, type Product } from './sales'

export type InventoryMovement = {
  id: string
  product_id: string
  type: 'entrada' | 'salida'
  quantity: number
  reason: string | null
  created_at: string
  product?: Product | null
}

export type Recipe = {
  id: string
  product_id: string
  name: string
  output_qty: number
  labor_cost: number
  overhead_cost: number
  notes: string | null
  created_at: string
  product?: Product | null
  ingredients?: RecipeIngredient[]
}

export type RecipeIngredient = {
  id?: string
  recipe_id?: string
  product_id: string
  name: string
  quantity: number
  unit_cost: number
  total: number
}

export async function fetchMovements(businessId: string) {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, product:products(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data || []) as unknown as InventoryMovement[]
}

export async function createProduct(businessId: string, p: Partial<Product>) {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...p, business_id: businessId })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Product
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const { error } = await supabase.from('products').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function adjustStock(
  businessId: string,
  userId: string,
  productId: string,
  type: 'entrada' | 'salida',
  quantity: number,
  reason: string
) {
  if (type === 'entrada') {
    await supabase.rpc('increment_stock', { p_id: productId, qty: quantity })
  } else {
    await supabase.rpc('decrement_stock', { p_id: productId, qty: quantity })
  }
  await supabase.from('inventory_movements').insert({
    business_id: businessId,
    product_id: productId,
    type,
    quantity,
    reason,
    user_id: userId,
  })
}

export async function fetchRecipes(businessId: string) {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, product:products(*)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const recipes = (data || []) as unknown as Recipe[]
  for (const r of recipes) {
    const { data: ings } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', r.id)
    r.ingredients = (ings || []) as unknown as RecipeIngredient[]
  }
  return recipes
}

export async function createRecipe(
  businessId: string,
  r: {
    product_id: string
    name: string
    output_qty: number
    labor_cost: number
    overhead_cost: number
    notes: string
    ingredients: RecipeIngredient[]
  }
) {
  const { data: row, error } = await supabase
    .from('recipes')
    .insert({
      business_id: businessId,
      product_id: r.product_id,
      name: r.name,
      output_qty: r.output_qty,
      labor_cost: r.labor_cost,
      overhead_cost: r.overhead_cost,
      notes: r.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  const recipeId = (row as any).id
  for (const ing of r.ingredients) {
    const { error: ie } = await supabase.from('recipe_ingredients').insert({
      recipe_id: recipeId,
      product_id: ing.product_id,
      name: ing.name,
      quantity: ing.quantity,
      unit_cost: ing.unit_cost,
      total: ing.total,
    })
    if (ie) throw ie
  }
  // Update product cost to the computed production cost per unit
  const totalIngredients = r.ingredients.reduce((s, i) => s + i.total, 0)
  const totalCost = totalIngredients + r.labor_cost + r.overhead_cost
  const unitCost = totalCost / (r.output_qty || 1)
  await supabase.rpc('update_product_cost', { p_id: r.product_id, new_cost: unitCost })
  return { id: recipeId }
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}

export async function runProduction(
  businessId: string,
  userId: string,
  recipeId: string,
  multiplier: number
) {
  await supabase.rpc('register_production', {
    r_id: recipeId,
    b_id: businessId,
    u_id: userId,
    multiplier,
  })
  // Refresh products so UI reflects new stock
  return await fetchProducts(businessId)
}

export function recipeUnitCost(r: Recipe): number {
  const ingredients = r.ingredients || []
  const totalIngredients = ingredients.reduce((s, i) => s + i.total, 0)
  const total = totalIngredients + Number(r.labor_cost) + Number(r.overhead_cost)
  return total / (Number(r.output_qty) || 1)
}
