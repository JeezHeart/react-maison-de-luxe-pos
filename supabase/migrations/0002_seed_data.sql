-- Maison de Luxe POS — seed data
-- Mirrors the app's localStorage seeds (src/data/menu.js + orderStore
-- SEED_DEFS) so the database starts with identical demo content.
-- All inserts are idempotent (ON CONFLICT DO NOTHING).

-- ---------------------------------------------------------------------------
-- Menu catalog
-- ---------------------------------------------------------------------------
insert into public.menu_items (id, name, category, description, price, stock) values
  (1,  'Tofu Scramble',           'Breakfast',  'Healthy tofu scramble with mixed vegetables.',           540.00, 11),
  (2,  'Classic Pancakes Stack',   'Breakfast',  'Fluffy pancakes with maple butter and berries.',          480.00, 14),
  (3,  'Eggs Benedict',            'Breakfast',  'Poached eggs on English muffin with hollandaise.',        520.00, 10),
  (4,  'French Toast Royale',      'Breakfast',  'Brioche French toast with cinnamon cream.',               490.00, 12),
  (5,  'Breakfast Burrito',        'Breakfast',  'Scrambled eggs, beans, cheese, and salsa wrap.',          550.00, 9),
  (6,  'Avocado Toast',            'Breakfast',  'Sourdough toast with smashed avocado and chili flakes.',  460.00, 15),
  (7,  'Pasta Bolognese',          'Lunch',      'Creamy pasta with rich bolognese sauce.',                 585.00, 12),
  (8,  'Spicy Fried Chicken',      'Lunch',      'Crispy chicken with premium spicy blend.',                620.00, 9),
  (9,  'Spaghetti Carbonara',      'Lunch',      'Classic carbonara with parmesan and bacon.',              560.00, 14),
  (10, 'Chicken Caesar Wrap',      'Lunch',      'Grilled chicken, romaine, and Caesar dressing in wrap.',  540.00, 13),
  (11, 'Beef Teriyaki Bowl',       'Lunch',      'Steamed rice with teriyaki beef and vegetables.',         595.00, 11),
  (12, 'Grilled Salmon Plate',     'Lunch',      'Grilled salmon with lemon herb rice and greens.',         680.00, 8),
  (13, 'Grilled Steak',            'Dinner',     'Premium grilled steak with herb butter.',                 1450.00, 8),
  (14, 'Fish and Chips',           'Dinner',     'Crispy battered fish with potato chips.',                 980.00, 6),
  (15, 'Ratatouille',              'Dinner',     'Fresh vegetables in tomato herb reduction.',              610.00, 15),
  (16, 'Herb Roasted Chicken',     'Dinner',     'Half chicken roasted with rosemary and jus.',             720.00, 10),
  (17, 'Lamb Chops',               'Dinner',     'Grilled lamb chops with mint glaze.',                     1280.00, 7),
  (18, 'Seafood Paella',           'Dinner',     'Saffron rice with shrimp, mussels, and calamari.',        890.00, 9),
  (19, 'Kimchi Jigae',             'Soup',       'Traditional spicy Korean kimchi stew.',                   520.00, 10),
  (20, 'Tomato Basil Soup',        'Soup',       'Creamy tomato soup with fresh basil.',                    380.00, 16),
  (21, 'French Onion Soup',        'Soup',       'Caramelized onion broth with melted cheese.',             420.00, 14),
  (22, 'Miso Soup',                'Soup',       'Light miso broth with tofu and wakame.',                  350.00, 18),
  (23, 'Clam Chowder',             'Soup',       'Creamy New England clam chowder bowl.',                   480.00, 12),
  (24, 'Pumpkin Soup',             'Soup',       'Roasted pumpkin soup with toasted seeds.',                360.00, 15),
  (25, 'Chocolate Mousse',         'Desserts',   'Silky dark chocolate mousse cup.',                        350.00, 20),
  (26, 'Creme Brulee',             'Desserts',   'Vanilla custard with caramelized sugar top.',             380.00, 16),
  (27, 'New York Cheesecake',      'Desserts',   'Rich cheesecake with berry compote.',                     420.00, 14),
  (28, 'Tiramisu',                 'Desserts',   'Espresso-soaked ladyfingers and mascarpone.',             390.00, 17),
  (29, 'Mango Panna Cotta',        'Desserts',   'Creamy panna cotta with fresh mango.',                    360.00, 18),
  (30, 'Berry Pavlova',            'Desserts',   'Crisp meringue with whipped cream and berries.',          400.00, 13),
  (31, 'Truffle Parmesan Fries',   'Side Dish',  'Crispy fries finished with truffle oil and parmesan.',   420.00, 18),
  (32, 'Garlic Butter Asparagus',  'Side Dish',  'Sauteed asparagus in roasted garlic butter glaze.',       390.00, 16),
  (33, 'Mashed Potatoes',          'Side Dish',  'Creamy butter mashed potatoes.',                          320.00, 20),
  (34, 'Caesar Side Salad',        'Side Dish',  'Romaine, parmesan, and Caesar dressing.',                340.00, 17),
  (35, 'Coleslaw Cup',             'Side Dish',  'Crunchy cabbage slaw with light dressing.',               280.00, 19),
  (36, 'Garlic Rice',              'Side Dish',  'Steamed rice tossed with garlic and butter.',             300.00, 22),
  (37, 'Lobster Bisque Shot',      'Appetizer',  'Creamy lobster bisque starter with herb cream.',          460.00, 14),
  (38, 'Seared Scallops',          'Appetizer',  'Pan-seared scallops with citrus herb dressing.',          690.00, 12),
  (39, 'Bruschetta Trio',          'Appetizer',  'Tomato, olive, and basil bruschetta assortment.',         380.00, 15),
  (40, 'Calamari Rings',           'Appetizer',  'Crispy fried calamari with lemon aioli.',                 450.00, 13),
  (41, 'Caprese Skewers',          'Appetizer',  'Mozzarella, tomato, and basil skewers.',                 360.00, 16),
  (42, 'Shrimp Cocktail',          'Appetizer',  'Chilled shrimp with cocktail sauce.',                     520.00, 11),
  (43, 'Lemon Mocktail',           'Beverages',  'Refreshing premium citrus mocktail.',                     280.00, 30),
  (44, 'Iced Americano',           'Beverages',  'Chilled espresso over ice.',                              220.00, 28),
  (45, 'Fresh Mango Shake',        'Beverages',  'Blended ripe mango with milk and ice.',                   310.00, 25),
  (46, 'House Iced Tea',           'Beverages',  'Brewed black tea served over ice.',                       180.00, 32),
  (47, 'Iced Matcha Latte',        'Beverages',  'Chilled matcha with milk and a light honey finish.',      290.00, 27),
  (48, 'Hot Chocolate',            'Beverages',  'Rich cocoa with steamed milk foam.',                      260.00, 24)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Customers (loyalty tiers)
-- ---------------------------------------------------------------------------
insert into public.customers (name, visits, total_spent, tier) values
  ('Walk-in Customer',    1,   704.00, 'Bronze'),
  ('Maria Santos',        1,  2266.00, 'Bronze'),
  ('John Reyes',          1,  1485.00, 'Bronze'),
  ('Ana Cruz',            1,  2255.00, 'Bronze'),
  ('Emma Cruz',           1,     0.00, 'Bronze'),
  ('Paolo Garcia',        1,   913.00, 'Bronze'),
  ('Liza Mendoza',        1,  1320.00, 'Bronze'),
  ('Carl Dizon',          1,  1397.00, 'Bronze'),
  ('Diego Lopez',         1,     0.00, 'Bronze'),
  ('Nina Bautista',       1,   902.00, 'Bronze'),
  ('Marco Villanueva',    1,  1694.00, 'Bronze'),
  ('Sofia Ramos',         1,  1562.00, 'Bronze'),
  ('Adrian Santos',       1,  1232.00, 'Bronze'),
  ('Kayla Torres',        1,   792.00, 'Bronze'),
  ('Ramon Aguilar',       1,  1892.00, 'Bronze')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('pos_restaurant_name', 'Maison de Luxe'),
  ('pos_restaurant_contact', ''),
  ('pos_restaurant_address', '')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Orders + line items (identical demo history to the localStorage seeds)
-- ---------------------------------------------------------------------------
insert into public.orders
  (id, customer_name, order_type, sub_total, discount_amount, discount_label,
   tax_amount, total_amount, payment_method, order_status, cashier_name, created_at)
values
  (1,  'Ramon Aguilar',     'Delivery', 1720.00, 0, '', 172.00, 1892.00, 'Credit Card', 'Completed', 'Main Cashier', now() - interval '38 days' - interval '50 minutes'),
  (2,  'Kayla Torres',      'Dine-in',   720.00, 0, '',  72.00,  792.00, 'Maya',        'Completed', 'Main Cashier', now() - interval '27 days' - interval '15 minutes'),
  (3,  'Adrian Santos',     'Takeout',  1120.00, 0, '', 112.00, 1232.00, 'Cash Payout', 'Completed', 'Main Cashier', now() - interval '18 days' - interval '60 minutes'),
  (4,  'Sofia Ramos',       'Dine-in',  1420.00, 0, '', 142.00, 1562.00, 'Paylater',    'Completed', 'Main Cashier', now() - interval '13 days' - interval '30 minutes'),
  (5,  'Marco Villanueva',  'Delivery', 1540.00, 0, '', 154.00, 1694.00, 'Credit Card', 'Completed', 'Main Cashier', now() - interval '9 days' - interval '45 minutes'),
  (6,  'Nina Bautista',     'Dine-in',   820.00, 0, '',  82.00,  902.00, 'Cash Payout', 'Completed', 'Main Cashier', now() - interval '6 days' - interval '10 minutes'),
  (7,  'Diego Lopez',       'Takeout',  1260.00, 0, '', 126.00, 1386.00, 'Cash Payout', 'Cancelled', 'Main Cashier', now() - interval '5 days' - interval '90 minutes'),
  (8,  'Carl Dizon',        'Dine-in',  1270.00, 0, '', 127.00, 1397.00, 'GCash',       'Completed', 'Main Cashier', now() - interval '4 days' - interval '40 minutes'),
  (9,  'Liza Mendoza',      'Dine-in',  1200.00, 0, '', 120.00, 1320.00, 'Credit Card', 'Completed', 'Main Cashier', now() - interval '3 days' - interval '15 minutes'),
  (10, 'Paolo Garcia',      'Dine-in',   830.00, 0, '',  83.00,  913.00, 'Cash Payout', 'Completed', 'Main Cashier', now() - interval '2 days' - interval '70 minutes'),
  (11, 'Emma Cruz',         'Takeout',   730.00, 0, '',  73.00,  803.00, 'Paylater',    'Pending',   'Main Cashier', now() - interval '2 days' - interval '30 minutes'),
  (12, 'Ana Cruz',          'Dine-in',  2050.00, 0, '', 205.00, 2255.00, 'Credit Card', 'Completed', 'Main Cashier', now() - interval '1 day' - interval '20 minutes'),
  (13, 'John Reyes',        'Takeout',  1350.00, 0, '', 135.00, 1485.00, 'Paylater',    'Completed', 'Main Cashier', now() - interval '0 days' - interval '250 minutes'),
  (14, 'Maria Santos',      'Dine-in',  2060.00, 0, '', 206.00, 2266.00, 'Cash Payout', 'Completed', 'Main Cashier', now() - interval '0 days' - interval '125 minutes'),
  (15, 'Walk-in Customer',  'Dine-in',   640.00, 0, '',  64.00,  704.00, 'Credit Card', 'Completed', 'Main Cashier', now() - interval '0 days' - interval '40 minutes')
on conflict (id) do nothing;

insert into public.order_items (order_id, name, quantity, unit_price, subtotal) values
  (1,  'Ratatouille',           1,  610.00,  610.00),
  (1,  'Herb Roasted Chicken',  1,  720.00,  720.00),
  (1,  'Tiramisu',              1,  390.00,  390.00),
  (2,  'Avocado Toast',         1,  460.00,  460.00),
  (2,  'Hot Chocolate',         1,  260.00,  260.00),
  (3,  'Kimchi Jigae',          1,  520.00,  520.00),
  (3,  'Garlic Rice',           2,  300.00,  600.00),
  (4,  'Grilled Salmon Plate',  1,  680.00,  680.00),
  (4,  'Tomato Basil Soup',     1,  380.00,  380.00),
  (4,  'Mango Panna Cotta',     1,  360.00,  360.00),
  (5,  'Beef Teriyaki Bowl',    2,  595.00, 1190.00),
  (5,  'Miso Soup',             1,  350.00,  350.00),
  (6,  'Chicken Caesar Wrap',   1,  540.00,  540.00),
  (6,  'Coleslaw Cup',          1,  280.00,  280.00),
  (7,  'Fish and Chips',        1,  980.00,  980.00),
  (7,  'Lemon Mocktail',        1,  280.00,  280.00),
  (8,  'Seafood Paella',        1,  890.00,  890.00),
  (8,  'Creme Brulee',         1,  380.00,  380.00),
  (9,  'Spicy Fried Chicken',   1,  620.00,  620.00),
  (9,  'Garlic Rice',           1,  300.00,  300.00),
  (9,  'Lemon Mocktail',        1,  280.00,  280.00),
  (10, 'Eggs Benedict',         1,  520.00,  520.00),
  (10, 'Fresh Mango Shake',     1,  310.00,  310.00),
  (11, 'Breakfast Burrito',     1,  550.00,  550.00),
  (11, 'House Iced Tea',        1,  180.00,  180.00),
  (12, 'Lamb Chops',            1, 1280.00, 1280.00),
  (12, 'French Onion Soup',     1,  420.00,  420.00),
  (12, 'Chocolate Mousse',      1,  350.00,  350.00),
  (13, 'Pasta Bolognese',       2,  585.00, 1170.00),
  (13, 'House Iced Tea',        1,  180.00,  180.00),
  (14, 'Grilled Steak',         1, 1450.00, 1450.00),
  (14, 'Mashed Potatoes',       1,  320.00,  320.00),
  (14, 'Iced Matcha Latte',     1,  290.00,  290.00),
  (15, 'Truffle Parmesan Fries', 1,  420.00,  420.00),
  (15, 'Iced Americano',        1,  220.00,  220.00)
on conflict do nothing;