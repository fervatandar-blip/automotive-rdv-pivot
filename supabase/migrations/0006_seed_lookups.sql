-- Seed data for the brands/specialties lookup tables introduced in
-- migration 0004, so the garage onboarding wizard has options to select.

insert into brands (name) values
  ('Volkswagen'), ('Mercedes-Benz'), ('BMW'), ('Audi'), ('Renault'),
  ('Peugeot'), ('Opel'), ('Toyota'), ('Ford'), ('Volvo'), ('Škoda'),
  ('Seat'), ('Fiat'), ('Citroën'), ('Tesla'), ('Porsche'), ('Land Rover'),
  ('Hyundai'), ('Kia'), ('Nissan')
on conflict (name) do nothing;

insert into specialties (name) values
  ('General Maintenance'), ('Engine Repair'), ('Transmission'),
  ('Bodywork & Paint'), ('Tires & Wheels'), ('Brakes'),
  ('Electrical & Diagnostics'), ('Air Conditioning'), ('EV & Hybrid Systems'),
  ('Detailing'), ('Glass Repair'), ('Exhaust Systems')
on conflict (name) do nothing;
