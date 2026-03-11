import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.lines as mlines

# Set up figure with larger dimensions for better spacing
fig = plt.figure(figsize=(10, 12), dpi=150)  # Adjusted DPI for better LaTeX scaling
ax = fig.add_subplot(111)
ax.set_xlim(0, 3000)
ax.set_ylim(0, 3600)
ax.axis('off')

# Colors
colors = {
    'data_bg': '#E3F2FD',
    'analysis_bg': '#E8F5E9',
    'presentation_bg': '#F5F5F5',
    'text': '#333333',
    'border': '#555555',
    'arrow': '#666666'
}

# Layer positions (scaled up for better spacing)
layers = [
    {'name': 'DATA LAYER', 'y': 2600, 'height': 850, 'color': colors['data_bg']},
    {'name': 'ANALYSIS LAYER', 'y': 1500, 'height': 850, 'color': colors['analysis_bg']},
    {'name': 'PRESENTATION LAYER', 'y': 400, 'height': 850, 'color': colors['presentation_bg']}
]

# Draw layer backgrounds and labels
for layer in layers:
    # Background
    rect = patches.Rectangle((200, layer['y']), 2600, layer['height']-100, 
                            linewidth=3, edgecolor=colors['border'], 
                            facecolor=layer['color'], alpha=0.7)
    ax.add_patch(rect)
    
    # Layer label
    ax.text(100, layer['y'] + 350, layer['name'], 
           fontsize=18, fontweight='bold', ha='center', va='center',
           rotation=90, color=colors['text'])

# Component positions for each layer (scaled up with better spacing)
components = {
    'data': [
        {'name': 'Satellite Data', 'sub': ['NDVI Estimation', 'Geolocation Analysis'], 
         'x': 650, 'y': 2950},
        {'name': 'Weather API', 'sub': ['Open-Meteo', 'Temperature & Rainfall'], 
         'x': 1500, 'y': 2950},
        {'name': 'Database', 'sub': ['SQLite/Prisma', 'GeoJSON Polygons'], 
         'x': 2350, 'y': 2950}
    ],
    'analysis': [
        {'name': 'Python ML Pipeline', 'sub': ['Model Training', 'Scikit-learn'], 
         'x': 650, 'y': 1850},
        {'name': 'JavaScript Inference', 'sub': ['Real-time Predictions', 'Logistic Regression'], 
         'x': 1500, 'y': 1850},
        {'name': 'Rule Engine', 'sub': ['Recommendations', 'Expert Rules'], 
         'x': 2350, 'y': 1850}
    ],
    'presentation': [
        {'name': 'Next.js Web App', 'sub': ['React Components', 'TypeScript'], 
         'x': 650, 'y': 750},
        {'name': 'Interactive Maps', 'sub': ['React-Leaflet', 'Polygon Drawing'], 
         'x': 1500, 'y': 750},
        {'name': 'Dashboard UI', 'sub': ['Analysis Results', 'Recommendations'], 
         'x': 2350, 'y': 750}
    ]
}

# Draw component boxes (larger with better text spacing)
for layer_name, comps in components.items():
    for comp in comps:
        # Box (much larger)
        box = FancyBboxPatch((comp['x']-350, comp['y']-180), 700, 360,
                           boxstyle="round,pad=0.02,rounding_size=20",
                           linewidth=4, edgecolor=colors['border'],
                           facecolor='white', alpha=0.95)
        ax.add_patch(box)
        
        # Title (larger font)
        ax.text(comp['x'], comp['y']-50, comp['name'],
               fontsize=16, fontweight='bold', ha='center', va='center',
               color=colors['text'])
        
        # Subtext (larger font with more spacing)
        for i, sub in enumerate(comp['sub']):
            ax.text(comp['x'], comp['y']+30 + i*50, sub,
                   fontsize=12, ha='center', va='center',
                   color=colors['text'], alpha=0.8)

# Draw arrows between layers (scaled up)
arrows = [
    # Data to Analysis
    [(650, 2700), (650, 2100)],  # Satellite to ML
    [(1500, 2700), (1500, 2100)],  # Weather to Inference
    [(2350, 2700), (2350, 2100)],  # Database to Rule
    # Analysis to Presentation
    [(650, 1600), (650, 1000)],  # ML to Web App
    [(1500, 1600), (1500, 1000)],  # Inference to Maps
    [(2350, 1600), (2350, 1000)]   # Rule to Dashboard
]

for start, end in arrows:
    arrow = FancyArrowPatch(start, end, 
                          arrowstyle='->', 
                          mutation_scale=60,
                          linewidth=6,
                          color=colors['arrow'])
    ax.add_patch(arrow)

# Save with proper sizing
plt.tight_layout(pad=0.5)
plt.savefig('system_architecture_diagram.png', dpi=150, bbox_inches='tight', 
            facecolor='white', edgecolor='none')
print("Diagram saved as 'system_architecture_diagram.png'")
print("Image will be automatically scaled to 3.5 inches width when included in LaTeX")
plt.show()
