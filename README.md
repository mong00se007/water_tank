# Water Tank Card

A high-performance, visually appealing Home Assistant custom card for monitoring water tanks. It features dynamic animations for rain inflow and usage outflow, temperature-based color shifting, and safety warnings.

![Water Tank Card]

## Features
- **Dynamic Water Level**: Real-time visualization of tank volume.
- **Graphic Pipes**: Visual pipes for inflow (top) and outflow (bottom) that animate when active.
- **Animations**:
  - **Inflow**: A scrolling blue stream falls from the top pipe when it rains.
  - **Outflow**: A vertical blue jet falls from the bottom pipe when water is being used.
- **Safety Warnings**:
  - **High Temp**: Flashing red icon at the top if temp exceeds `warning_threshold`.
  - **Low Water**: Flashing blue/red icon at the bottom if level drops below `low_level_threshold`.
- **Overlay Information**: Percentage (to 1 decimal) and Temperature are displayed directly inside the tank.
- **Visual Editor**: Fully configurable via the Lovelace UI editor.

## Installation

### HACS (Recommended)
1. Add this URL as a custom repository in HACS.
2. Search for `Water Tank Card`.
3. Click Install.

### Manual
1. Download `water-tank-card.js` and `water-tank-card-editor.js`.
2. Save them to `/config/www/`.
3. Add the following to your Lovelace resources:
   ```yaml
   url: /local/water-tank-card.js
   type: module
   ```

## Configuration

You can configure this card using the **Visual Editor** in Lovelace, or via YAML:

```yaml
type: custom:water-tank-card
name: My Water Tank
entity: sensor.water_level
temp_entity: sensor.water_temp
rain_entity: sensor.rain_today_total
inflow_entity: sensor.rain_rate_current
outflow_entity: binary_sensor.water_usage
roof_size: 100
us_units: false
warning_threshold: 20
low_level_threshold: 10
```

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | **Required** | `custom:water-tank-card` |
| `entity` | string | **Required** | The volume sensor (L or %). |
| `temp_entity` | string | Optional | The temperature sensor. |
| `rain_entity` | string | Optional | The rain total sensor (accumulated volume today). |
| `inflow_entity` | string | Optional | The rain rate sensor (mm/h or in/h). Triggers inflow animation if > 0. |
| `outflow_entity` | string | Optional | A single entity to monitor for usage. Triggers outflow animation when `on` or > 0. |
| `max_volume` | number | Optional | Required if your volume entity is in Liters/Gallons to calculate percentage. |
| `roof_size` | number | 100 | Your roof area (m² or ft²) for inflow calculation. |
| `us_units` | boolean | false | Toggle to use US Units (Gallons, ft², °F). |
| `warning_threshold` | number | 20 | Temperature threshold for alert (°C). |
| `low_level_threshold` | number | 10 | Low water level threshold (%). |

## License
MIT

