<template>
  <aside class="property-panel">
    <div class="panel-header">
      <h3>属性</h3>
    </div>

    <div class="panel-content">
      <template v-if="selectedComponents.length > 1">
        <div class="component-summary batch-summary">
          <span class="component-type">多选</span>
          <span class="component-id">已选 {{ selectedComponents.length }} 个组件</span>
        </div>

        <div class="property-section">
          <div class="section-title">位置尺寸</div>
          <div class="property-item">
            <label>X</label>
            <div class="input-with-unit">
              <input type="number" :value="batchValue('x')" :placeholder="batchPlaceholder('x')" @input="batchUpdateField('x', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>Y</label>
            <div class="input-with-unit">
              <input type="number" :value="batchValue('y')" :placeholder="batchPlaceholder('y')" @input="batchUpdateField('y', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>宽度</label>
            <div class="input-with-unit">
              <input type="number" :value="batchValue('width')" :placeholder="batchPlaceholder('width')" @input="batchUpdateField('width', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>高度</label>
            <div class="input-with-unit">
              <input type="number" :value="batchValue('height')" :placeholder="batchPlaceholder('height')" @input="batchUpdateField('height', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>缩放</label>
            <div class="scale-control">
              <input type="number" min="10" max="500" step="10" value="100" ref="scaleInputRef" />
              <span>%</span>
              <button class="scale-apply-btn" @click="applyBatchScale">应用</button>
            </div>
          </div>
        </div>

        <div class="property-section">
          <div class="section-title">基础</div>
          <div class="property-item">
            <label>隐藏</label>
            <label class="toggle-switch">
              <input type="checkbox" :checked="!!batchValue('hidden', false)" @change="batchUpdateField('hidden', ($event.target as HTMLInputElement).checked)" />
              <span class="toggle-slider"></span>
            </label>
            <span class="value-text">打印时不可见</span>
          </div>
          <div class="property-item">
            <label>锁定</label>
            <label class="toggle-switch">
              <input type="checkbox" :checked="!!batchValue('locked', false)" @change="batchUpdateField('locked', ($event.target as HTMLInputElement).checked)" />
              <span class="toggle-slider"></span>
            </label>
            <span class="value-text">不可拖拽缩放</span>
          </div>
          <div class="property-item">
            <label>旋转</label>
            <div class="input-with-unit">
              <input type="number" :value="batchValue('rotate')" :placeholder="batchPlaceholder('rotate')" @input="batchUpdateField('rotate', inputNumber($event))" />
              <span>deg</span>
            </div>
          </div>
          <div class="property-item">
            <label>透明度</label>
            <input class="range-input" type="range" min="0" max="1" step="0.05" :value="batchValue('opacity', 1)" @input="batchUpdateField('opacity', inputNumber($event))" />
            <span class="value-text">{{ batchValue('opacity', 1) !== null ? Math.round(Number(batchValue('opacity', 1)) * 100) + '%' : '-' }}</span>
          </div>
        </div>

        <div v-if="batchHasType('text') || batchHasType('page-header') || batchHasType('page-footer') || batchHasType('page-number') || batchHasType('watermark')" class="property-section">
          <div class="section-title">公共文本属性</div>
          <div class="property-item">
            <label>字体大小</label>
            <input type="number" :value="batchOptionValue('fontSize')" :placeholder="batchOptionPlaceholder('fontSize')" @input="batchUpdateOption('fontSize', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>字体</label>
            <select :value="batchOptionValue('fontFamily')" @change="batchUpdateOption('fontFamily', inputValue($event))">
              <option value="">-</option>
              <option value="Arial">Arial</option>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimSun">宋体</option>
              <option value="SimHei">黑体</option>
              <option value="Courier New">Courier New</option>
              <option value="monospace">monospace</option>
            </select>
          </div>
          <div class="property-item">
            <label>字重</label>
            <div class="segmented">
              <button type="button" :class="{ active: batchOptionValue('fontWeight') === 'normal' }" @click="batchUpdateOption('fontWeight', 'normal')">常规</button>
              <button type="button" :class="{ active: batchOptionValue('fontWeight') === 'bold' }" @click="batchUpdateOption('fontWeight', 'bold')">B</button>
              <button type="button" :class="{ active: batchOptionValue('fontWeight') === 'lighter' }" @click="batchUpdateOption('fontWeight', 'lighter')">细</button>
            </div>
          </div>
          <div class="property-item">
            <label>颜色</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('color') || '#000000'" @input="batchUpdateOption('color', inputValue($event))" />
              <span>{{ batchOptionValue('color') || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>对齐</label>
            <div class="segmented">
              <button type="button" :class="{ active: batchOptionValue('textAlign') === 'left' }" @click="batchUpdateOption('textAlign', 'left')">左</button>
              <button type="button" :class="{ active: batchOptionValue('textAlign') === 'center' }" @click="batchUpdateOption('textAlign', 'center')">中</button>
              <button type="button" :class="{ active: batchOptionValue('textAlign') === 'right' }" @click="batchUpdateOption('textAlign', 'right')">右</button>
            </div>
          </div>
        </div>

        <div v-if="batchAllSameType('line')" class="property-section">
          <div class="section-title">线条属性</div>
          <div class="property-item">
            <label>颜色</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('color') || '#000000'" @input="batchUpdateOption('color', inputValue($event))" />
              <span>{{ batchOptionValue('color') || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>线宽</label>
            <input type="number" step="0.5" :value="batchOptionValue('lineWidth')" :placeholder="batchOptionPlaceholder('lineWidth')" @input="batchUpdateOption('lineWidth', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>线型</label>
            <select :value="batchOptionValue('lineStyle') || 'solid'" @change="batchUpdateOption('lineStyle', inputValue($event))">
              <option value="">-</option>
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
              <option value="dotted">点线</option>
            </select>
          </div>
        </div>

        <div v-if="batchAllSameType('rect') || batchAllSameType('ellipse')" class="property-section">
          <div class="section-title">{{ batchAllSameType('ellipse') ? '椭圆属性' : '矩形属性' }}</div>
          <div class="property-item">
            <label>背景色</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('backgroundColor') || '#ffffff'" @input="batchUpdateOption('backgroundColor', inputValue($event))" />
              <span>{{ batchOptionValue('backgroundColor') || '#ffffff' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>边框色</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('borderColor') || '#000000'" @input="batchUpdateOption('borderColor', inputValue($event))" />
              <span>{{ batchOptionValue('borderColor') || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>边框宽</label>
            <input type="number" step="0.5" :value="batchOptionValue('borderWidth')" :placeholder="batchOptionPlaceholder('borderWidth')" @input="batchUpdateOption('borderWidth', inputNumber($event))" />
          </div>
        </div>

        <div v-if="batchAllSameType('barcode')" class="property-section">
          <div class="section-title">条码属性</div>
          <div class="property-item">
            <label>格式</label>
            <select :value="batchOptionValue('format') || 'CODE128'" @change="batchUpdateOption('format', inputValue($event))">
              <option value="">-</option>
              <option value="CODE128">CODE128</option>
              <option value="CODE39">CODE39</option>
              <option value="EAN13">EAN13</option>
              <option value="EAN8">EAN8</option>
              <option value="UPC">UPC</option>
              <option value="ITF">ITF</option>
            </select>
          </div>
          <div class="property-item">
            <label>线条色</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('lineColor') || '#000000'" @input="batchUpdateOption('lineColor', inputValue($event))" />
              <span>{{ batchOptionValue('lineColor') || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>背景</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('background') || '#ffffff'" @input="batchUpdateOption('background', inputValue($event))" />
              <span>{{ batchOptionValue('background') || '#ffffff' }}</span>
            </div>
          </div>
        </div>

        <div v-if="batchAllSameType('qrcode')" class="property-section">
          <div class="section-title">二维码属性</div>
          <div class="property-item">
            <label>纠错级别</label>
            <select :value="batchOptionValue('level') || 'M'" @change="batchUpdateOption('level', inputValue($event))">
              <option value="">-</option>
              <option value="L">低 (L)</option>
              <option value="M">中 (M)</option>
              <option value="Q">较高 (Q)</option>
              <option value="H">高 (H)</option>
            </select>
          </div>
          <div class="property-item">
            <label>留白</label>
            <input type="number" min="0" :value="batchOptionValue('margin')" :placeholder="batchOptionPlaceholder('margin')" @input="batchUpdateOption('margin', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>码色</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('darkColor') || '#000000'" @input="batchUpdateOption('darkColor', inputValue($event))" />
              <span>{{ batchOptionValue('darkColor') || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>背景</label>
            <div class="color-field">
              <input type="color" :value="batchOptionValue('lightColor') || '#ffffff'" @input="batchUpdateOption('lightColor', inputValue($event))" />
              <span>{{ batchOptionValue('lightColor') || '#ffffff' }}</span>
            </div>
          </div>
        </div>

        <div class="property-section">
          <button class="delete-btn" @click="$emit('delete')">删除所选组件</button>
        </div>
      </template>

      <template v-else-if="selectedComponent">
        <div class="component-summary">
          <span class="component-type">{{ componentTypeLabel }}</span>
          <span class="component-id">{{ selectedComponent.id }}</span>
        </div>

        <div class="property-section">
          <div class="section-title">位置尺寸</div>
          <div class="property-item">
            <label>X</label>
            <div class="input-with-unit">
              <input type="number" :value="selectedComponent.x" @input="updateField('x', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>Y</label>
            <div class="input-with-unit">
              <input type="number" :value="selectedComponent.y" @input="updateField('y', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>宽度</label>
            <div class="input-with-unit">
              <input type="number" :value="selectedComponent.width" @input="updateField('width', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
          <div class="property-item">
            <label>高度</label>
            <div class="input-with-unit">
              <input type="number" :value="selectedComponent.height" @input="updateField('height', inputNumber($event))" />
              <span>mm</span>
            </div>
          </div>
        </div>

        <div class="property-section">
          <div class="section-title">基础</div>
          <div class="property-item">
            <label>隐藏</label>
            <label class="toggle-switch">
              <input type="checkbox" :checked="selectedComponent.hidden ?? false" @change="updateField('hidden', ($event.target as HTMLInputElement).checked)" />
              <span class="toggle-slider"></span>
            </label>
            <span class="value-text">打印时不可见</span>
          </div>
          <div class="property-item">
            <label>锁定</label>
            <label class="toggle-switch">
              <input type="checkbox" :checked="selectedComponent.locked ?? false" @change="updateField('locked', ($event.target as HTMLInputElement).checked)" />
              <span class="toggle-slider"></span>
            </label>
            <span class="value-text">不可拖拽缩放</span>
          </div>
          <div class="property-item">
            <label>旋转</label>
            <div class="input-with-unit">
              <input type="number" :value="selectedComponent.rotate || 0" @input="updateField('rotate', inputNumber($event))" />
              <span>deg</span>
            </div>
          </div>
          <div class="property-item">
            <label>透明度</label>
            <input class="range-input" type="range" min="0" max="1" step="0.05" :value="selectedComponent.opacity ?? 1" @input="updateField('opacity', inputNumber($event))" />
            <span class="value-text">{{ Math.round((selectedComponent.opacity ?? 1) * 100) }}%</span>
          </div>
          <div class="property-item">
            <label>层级</label>
            <input type="number" :value="selectedComponent.zIndex ?? 0" @input="updateField('zIndex', inputNumber($event))" />
          </div>
          <div v-if="!['table', 'qrcode', 'barcode', 'receipt-qrcode', 'receipt-barcode', 'receipt-feed', 'receipt-cut'].includes(selectedComponent.type)" class="property-item">
            <label>跨页续排</label>
            <div class="segmented">
              <button type="button" :class="{ active: selectedComponent.options.splitAcrossPages !== false }" @click="updateOption('splitAcrossPages', true)">允许</button>
              <button type="button" :class="{ active: selectedComponent.options.splitAcrossPages === false }" @click="updateOption('splitAcrossPages', false)">不拆分</button>
            </div>
            <span class="value-text">跨页时切片续排</span>
          </div>
        </div>

        <div v-if="['text', 'page-header', 'page-footer', 'page-number', 'watermark'].includes(selectedComponent.type)" class="property-section">
          <div class="section-title">{{ textSectionTitle }}</div>
          <div class="property-item full-width">
            <label>内容</label>
            <textarea :value="selectedComponent.options.content" rows="3" :placeholder="selectedComponent.type === 'page-number' ? '支持 {page} 和 {total}' : '支持 {{field}} 绑定'" @input="updateOption('content', inputValue($event))"></textarea>
          </div>
          <div v-if="selectedComponent.type === 'page-number'" class="field-hint">页码基础版当前按单页预览，<code>{page}</code> 和 <code>{total}</code> 会显示为 1。</div>
          <div v-else class="field-hint">使用 <code v-pre>{{fieldName}}</code> 语法绑定数据字段</div>
          <div class="property-item">
            <label>字体大小</label>
            <input type="number" :value="selectedComponent.options.fontSize" @input="updateOption('fontSize', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>行高</label>
            <input type="number" :value="selectedComponent.options.lineHeight || 18" @input="updateOption('lineHeight', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>字体</label>
            <select :value="selectedComponent.options.fontFamily" @change="updateOption('fontFamily', inputValue($event))">
              <option value="Arial">Arial</option>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimSun">宋体</option>
              <option value="SimHei">黑体</option>
              <option value="Courier New">Courier New</option>
              <option value="monospace">monospace</option>
            </select>
          </div>
          <div class="property-item">
            <label>字重</label>
            <div class="segmented">
              <button type="button" :class="{ active: selectedComponent.options.fontWeight === 'normal' || !selectedComponent.options.fontWeight }" @click="updateOption('fontWeight', 'normal')">常规</button>
              <button type="button" :class="{ active: selectedComponent.options.fontWeight === 'bold' }" @click="updateOption('fontWeight', 'bold')">B</button>
              <button type="button" :class="{ active: selectedComponent.options.fontWeight === 'lighter' }" @click="updateOption('fontWeight', 'lighter')">细</button>
            </div>
          </div>
          <div class="property-item">
            <label>对齐</label>
            <div class="segmented">
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'left' || !selectedComponent.options.textAlign }" @click="updateOption('textAlign', 'left')">左</button>
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'center' }" @click="updateOption('textAlign', 'center')">中</button>
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'right' }" @click="updateOption('textAlign', 'right')">右</button>
            </div>
          </div>
          <div class="property-item">
            <label>颜色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.color || '#000000'" @input="updateOption('color', inputValue($event))" />
              <span>{{ selectedComponent.options.color || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>换行</label>
            <div class="segmented">
              <button type="button" :class="{ active: (selectedComponent.options.whiteSpace || 'pre-wrap') === 'pre-wrap' }" @click="updateOption('whiteSpace', 'pre-wrap')">自动</button>
              <button type="button" :class="{ active: selectedComponent.options.whiteSpace === 'nowrap' }" @click="updateOption('whiteSpace', 'nowrap')">单行</button>
            </div>
          </div>
          <div class="property-item">
            <label>溢出</label>
            <div class="segmented">
              <button type="button" :class="{ active: (selectedComponent.options.overflow || 'hidden') === 'hidden' }" @click="updateOption('overflow', 'hidden')">隐藏</button>
              <button type="button" :class="{ active: selectedComponent.options.overflow === 'ellipsis' }" @click="updateOption('overflow', 'ellipsis')">省略</button>
              <button type="button" :class="{ active: selectedComponent.options.overflow === 'visible' }" @click="updateOption('overflow', 'visible')">显示</button>
            </div>
          </div>
          <div class="property-item">
            <label>最大行数</label>
            <input type="number" min="0" :value="selectedComponent.options.maxLines || 0" @input="updateOption('maxLines', inputNumber($event))" />
          </div>
          <template v-if="selectedComponent.type === 'watermark'">
            <div class="property-item">
              <label>水印模式</label>
              <div class="segmented">
                <button type="button" :class="{ active: (selectedComponent.options.mode || 'tile') === 'tile' }" @click="updateOption('mode', 'tile')">平铺</button>
                <button type="button" :class="{ active: selectedComponent.options.mode === 'center' }" @click="updateOption('mode', 'center')">居中</button>
              </div>
            </div>
            <div class="property-item">
              <label>角度</label>
              <div class="input-with-unit">
                <input type="number" :value="selectedComponent.options.rotate ?? -30" @input="updateOption('rotate', inputNumber($event))" />
                <span>deg</span>
              </div>
            </div>
            <div class="property-item">
              <label>透明度</label>
              <input class="range-input" type="range" min="0" max="1" step="0.05" :value="selectedComponent.options.opacity ?? 0.25" @input="updateOption('opacity', inputNumber($event))" />
              <span class="value-text">{{ Math.round((selectedComponent.options.opacity ?? 0.25) * 100) }}%</span>
            </div>
            <div v-if="(selectedComponent.options.mode || 'tile') === 'tile'" class="property-item">
              <label>平铺间距</label>
              <input type="number" min="40" :value="selectedComponent.options.tileSpacing || 120" @input="updateOption('tileSpacing', inputNumber($event))" />
            </div>
            <div class="field-hint">水印默认垫底（不挡其他组件的选择和编辑）；如需调整遮盖关系，在"基础 → 层级"设置 z-index。</div>
          </template>
        </div>

        <div v-if="selectedComponent.type === 'line'" class="property-section">
          <div class="section-title">线条属性</div>
          <div class="property-item">
            <label>颜色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.color || '#000000'" @input="updateOption('color', inputValue($event))" />
              <span>{{ selectedComponent.options.color || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>线宽</label>
            <input type="number" step="0.5" :value="selectedComponent.options.lineWidth" @input="updateOption('lineWidth', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>线型</label>
            <select :value="selectedComponent.options.lineStyle || 'solid'" @change="updateOption('lineStyle', inputValue($event))">
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
              <option value="dotted">点线</option>
            </select>
          </div>
          <div class="property-item">
            <label>方向</label>
            <select :value="selectedComponent.options.direction" @change="updateOption('direction', inputValue($event))">
              <option value="horizontal">横线</option>
              <option value="vertical">竖线</option>
            </select>
          </div>
        </div>

        <div v-if="selectedComponent.type === 'rect' || selectedComponent.type === 'ellipse'" class="property-section">
          <div class="section-title">{{ selectedComponent.type === 'ellipse' ? '椭圆属性' : '矩形属性' }}</div>
          <div class="property-item">
            <label>背景色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.backgroundColor || '#ffffff'" @input="updateOption('backgroundColor', inputValue($event))" />
              <span>{{ selectedComponent.options.backgroundColor || '#ffffff' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>边框色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.borderColor || '#000000'" @input="updateOption('borderColor', inputValue($event))" />
              <span>{{ selectedComponent.options.borderColor || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>边框宽</label>
            <input type="number" step="0.5" :value="selectedComponent.options.borderWidth" @input="updateOption('borderWidth', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>边框样式</label>
            <select :value="selectedComponent.options.borderStyle || 'solid'" @change="updateOption('borderStyle', inputValue($event))">
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
              <option value="dotted">点线</option>
            </select>
          </div>
          <div v-if="selectedComponent.type === 'rect'" class="property-item">
            <label>圆角</label>
            <input type="number" :value="selectedComponent.options.borderRadius" @input="updateOption('borderRadius', inputNumber($event))" />
          </div>
        </div>

        <div v-if="selectedComponent.type === 'image'" class="property-section">
          <div class="section-title">图片属性</div>
          <div class="property-item full-width">
            <label>图片地址</label>
            <textarea :value="selectedComponent.options.src" rows="3" placeholder="支持 URL、base64 或 {{field}} 绑定" @input="updateOption('src', inputValue($event))"></textarea>
          </div>
          <div class="field-hint">使用 <code v-pre>{{imageUrl}}</code> 可绑定图片字段</div>
          <div class="property-item">
            <label>填充方式</label>
            <div class="segmented">
              <button type="button" :class="{ active: (selectedComponent.options.objectFit || 'contain') === 'contain' }" @click="updateOption('objectFit', 'contain')">包含</button>
              <button type="button" :class="{ active: selectedComponent.options.objectFit === 'cover' }" @click="updateOption('objectFit', 'cover')">覆盖</button>
              <button type="button" :class="{ active: selectedComponent.options.objectFit === 'fill' }" @click="updateOption('objectFit', 'fill')">填充</button>
            </div>
          </div>
          <div class="property-item full-width">
            <label>图片对齐</label>
            <div class="position-grid">
              <button type="button" :class="{ active: imagePosition === 'left top' }" @click="updateOption('objectPosition', 'left top')">↖</button>
              <button type="button" :class="{ active: imagePosition === 'center top' }" @click="updateOption('objectPosition', 'center top')">↑</button>
              <button type="button" :class="{ active: imagePosition === 'right top' }" @click="updateOption('objectPosition', 'right top')">↗</button>
              <button type="button" :class="{ active: imagePosition === 'left center' }" @click="updateOption('objectPosition', 'left center')">←</button>
              <button type="button" :class="{ active: imagePosition === 'center center' }" @click="updateOption('objectPosition', 'center center')">•</button>
              <button type="button" :class="{ active: imagePosition === 'right center' }" @click="updateOption('objectPosition', 'right center')">→</button>
              <button type="button" :class="{ active: imagePosition === 'left bottom' }" @click="updateOption('objectPosition', 'left bottom')">↙</button>
              <button type="button" :class="{ active: imagePosition === 'center bottom' }" @click="updateOption('objectPosition', 'center bottom')">↓</button>
              <button type="button" :class="{ active: imagePosition === 'right bottom' }" @click="updateOption('objectPosition', 'right bottom')">↘</button>
            </div>
          </div>
          <div class="subsection-title">裁剪区域（百分比 0-100）</div>
          <div class="property-item">
            <label>X</label>
            <div class="input-with-unit">
              <input type="number" min="0" max="100" :value="selectedComponent.options.cropX ?? 0" @input="updateOption('cropX', inputNumber($event))" />
              <span>%</span>
            </div>
          </div>
          <div class="property-item">
            <label>Y</label>
            <div class="input-with-unit">
              <input type="number" min="0" max="100" :value="selectedComponent.options.cropY ?? 0" @input="updateOption('cropY', inputNumber($event))" />
              <span>%</span>
            </div>
          </div>
          <div class="property-item">
            <label>宽度</label>
            <div class="input-with-unit">
              <input type="number" min="1" max="100" :value="selectedComponent.options.cropWidth ?? 100" @input="updateOption('cropWidth', inputNumber($event))" />
              <span>%</span>
            </div>
          </div>
          <div class="property-item">
            <label>高度</label>
            <div class="input-with-unit">
              <input type="number" min="1" max="100" :value="selectedComponent.options.cropHeight ?? 100" @input="updateOption('cropHeight', inputNumber($event))" />
              <span>%</span>
            </div>
          </div>
          <div class="property-item">
            <label>重置裁剪</label>
            <button type="button" class="reset-crop-btn" @click="resetImageCrop">重置</button>
          </div>
        </div>

        <div v-if="selectedComponent.type === 'table'" class="property-section">
          <div class="section-title">表格属性</div>
          <div class="property-item full-width">
            <label>数据源</label>
            <input type="text" :value="selectedComponent.options.dataSourceField" placeholder="绑定数组字段，如 items" @input="updateOption('dataSourceField', inputValue($event))" />
          </div>
          <div class="field-hint">绑定一个数组字段，表格会按列配置循环渲染。</div>

          <div class="property-item">
            <label>显示表头</label>
            <input type="checkbox" :checked="selectedComponent.options.showHeader !== false" @change="updateOption('showHeader', inputChecked($event))" />
          </div>
          <div class="property-item">
            <label>表头高度</label>
            <input type="number" :value="selectedComponent.options.headerHeight || 30" @input="updateOption('headerHeight', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>行高</label>
            <input type="number" :value="selectedComponent.options.rowHeight || 25" @input="updateOption('rowHeight', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>字体大小</label>
            <input type="number" :value="selectedComponent.options.fontSize || 12" @input="updateOption('fontSize', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>字体</label>
            <select :value="selectedComponent.options.fontFamily || 'Arial'" @change="updateOption('fontFamily', inputValue($event))">
              <option value="Arial">Arial</option>
              <option value="Microsoft YaHei">微软雅黑</option>
              <option value="SimSun">宋体</option>
              <option value="monospace">monospace</option>
            </select>
          </div>
          <div class="property-item">
            <label>默认对齐</label>
            <div class="segmented">
              <button type="button" :class="{ active: (selectedComponent.options.textAlign || 'left') === 'left' }" @click="updateOption('textAlign', 'left')">左</button>
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'center' }" @click="updateOption('textAlign', 'center')">中</button>
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'right' }" @click="updateOption('textAlign', 'right')">右</button>
            </div>
          </div>
          <div class="property-item">
            <label>边框宽</label>
            <input type="number" :value="selectedComponent.options.borderWidth || 1" @input="updateOption('borderWidth', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>边框色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.borderColor || '#000000'" @input="updateOption('borderColor', inputValue($event))" />
              <span>{{ selectedComponent.options.borderColor || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>边框样式</label>
            <select :value="selectedComponent.options.borderStyle || 'solid'" @change="updateOption('borderStyle', inputValue($event))">
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
              <option value="dotted">点线</option>
            </select>
          </div>
          <div class="property-item">
            <label>边框显示</label>
            <div class="segmented">
              <button type="button" :class="{ active: selectedComponent.options.showOuterBorder !== false }" @click="updateOption('showOuterBorder', selectedComponent.options.showOuterBorder === false)">外框</button>
              <button type="button" :class="{ active: selectedComponent.options.showRowLines !== false }" @click="updateOption('showRowLines', selectedComponent.options.showRowLines === false)">横线</button>
              <button type="button" :class="{ active: selectedComponent.options.showColumnLines !== false }" @click="updateOption('showColumnLines', selectedComponent.options.showColumnLines === false)">竖线</button>
            </div>
          </div>
          <div class="property-item">
            <label>内边距</label>
            <input type="text" :value="selectedComponent.options.cellPadding || '4px 8px'" placeholder="4px 8px" @input="updateOption('cellPadding', inputValue($event))" />
          </div>
          <div class="property-item">
            <label>表头底色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.headerBackgroundColor || '#f5f5f5'" @input="updateOption('headerBackgroundColor', inputValue($event))" />
              <span>{{ selectedComponent.options.headerBackgroundColor || '#f5f5f5' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>表头文字</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.headerColor || '#000000'" @input="updateOption('headerColor', inputValue($event))" />
              <span>{{ selectedComponent.options.headerColor || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>表头字号</label>
            <input type="number" :value="selectedComponent.options.headerFontSize || selectedComponent.options.fontSize || 12" @input="updateOption('headerFontSize', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>表头对齐</label>
            <div class="segmented">
              <button type="button" :class="{ active: (selectedComponent.options.headerAlign || selectedComponent.options.textAlign || 'left') === 'left' }" @click="updateOption('headerAlign', 'left')">左</button>
              <button type="button" :class="{ active: selectedComponent.options.headerAlign === 'center' }" @click="updateOption('headerAlign', 'center')">中</button>
              <button type="button" :class="{ active: selectedComponent.options.headerAlign === 'right' }" @click="updateOption('headerAlign', 'right')">右</button>
            </div>
          </div>
          <div class="property-item">
            <label>行底色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.rowBackgroundColor || '#ffffff'" @input="updateOption('rowBackgroundColor', inputValue($event))" />
              <span>{{ selectedComponent.options.rowBackgroundColor || '#ffffff' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>交替底色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.alternatingRowBackgroundColor || '#fafafa'" @input="updateOption('alternatingRowBackgroundColor', inputValue($event))" />
              <span>{{ selectedComponent.options.alternatingRowBackgroundColor || '#fafafa' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>最大行数</label>
            <input type="number" min="0" :value="selectedComponent.options.maxRows || 0" @input="updateOption('maxRows', inputNumber($event))" />
          </div>
          <div class="property-item full-width">
            <label>空数据文案</label>
            <input type="text" :value="selectedComponent.options.emptyText || '暂无数据'" @input="updateOption('emptyText', inputValue($event))" />
          </div>
          <div class="property-item">
            <label>显示汇总</label>
            <input type="checkbox" :checked="selectedComponent.options.showSummary === true" @change="updateOption('showSummary', inputChecked($event))" />
          </div>
          <div v-if="selectedComponent.options.showSummary === true" class="property-item">
            <label>汇总标题</label>
            <input type="text" :value="selectedComponent.options.summaryLabel || '合计'" @input="updateOption('summaryLabel', inputValue($event))" />
          </div>
          <div v-if="selectedComponent.options.showSummary === true" class="property-item">
            <label>汇总字段</label>
            <input type="text" :value="selectedComponent.options.summaryField || ''" placeholder="如 amount" @input="updateOption('summaryField', inputValue($event))" />
          </div>
          <div v-if="selectedComponent.options.showSummary === true" class="property-item full-width">
            <label>汇总模板</label>
            <input type="text" :value="selectedComponent.options.summaryText || ''" placeholder="优先于汇总字段，支持 {{total}}" @input="updateOption('summaryText', inputValue($event))" />
          </div>
          <div class="property-item">
            <label>孤行保护</label>
            <input type="number" min="0" :value="selectedComponent.options.orphanRows ?? 1" @input="updateOption('orphanRows', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>每页小计</label>
            <input type="checkbox" :checked="selectedComponent.options.showPageSubtotal === true" @change="updateOption('showPageSubtotal', inputChecked($event))" />
          </div>
          <div v-if="selectedComponent.options.showPageSubtotal === true" class="property-item">
            <label>小计标题</label>
            <input type="text" :value="selectedComponent.options.pageSubtotalLabel || '小计'" @input="updateOption('pageSubtotalLabel', inputValue($event))" />
          </div>
          <div v-if="selectedComponent.options.showPageSubtotal === true" class="property-item">
            <label>小计字段</label>
            <input type="text" :value="selectedComponent.options.pageSubtotalField || selectedComponent.options.summaryField || ''" placeholder="如 amount" @input="updateOption('pageSubtotalField', inputValue($event))" />
          </div>

          <div class="subsection-title">列配置</div>
          <div class="columns-config">
            <div v-for="(column, index) in tableColumns" :key="index" class="column-item">
              <input type="text" :value="column.field" placeholder="字段名" @input="updateTableColumn(index, 'field', inputValue($event))" />
              <input type="text" :value="column.title" placeholder="标题" @input="updateTableColumn(index, 'title', inputValue($event))" />
              <input class="column-width" type="number" :value="column.width || 80" placeholder="宽" @input="updateTableColumn(index, 'width', inputNumber($event))" />
              <select class="column-align" :value="column.align || selectedComponent.options.textAlign || 'left'" @change="updateTableColumn(index, 'align', inputValue($event))">
                <option value="left">左</option>
                <option value="center">中</option>
                <option value="right">右</option>
              </select>
              <button type="button" class="merge-col-btn" :class="{ active: column.merge === true }" title="纵向合并相同值：与上方连续同值单元格合并；分页时在页边界截断，续页重新显示" @click="updateTableColumn(index, 'merge', column.merge !== true)">合</button>
              <button class="remove-col-btn" @click="removeTableColumn(index)">x</button>
              <input class="column-font-size" type="number" min="1" :value="column.fontSize || selectedComponent.options.fontSize || 12" placeholder="字号" @input="updateTableColumn(index, 'fontSize', inputNumber($event))" />
              <select class="column-weight" :value="column.fontWeight || 'normal'" @change="updateTableColumn(index, 'fontWeight', inputValue($event))">
                <option value="normal">常规</option>
                <option value="bold">加粗</option>
              </select>
              <div class="column-color-field">
                <input type="color" :value="column.color || '#000000'" title="文字颜色" @input="updateTableColumn(index, 'color', inputValue($event))" />
                <input type="color" :value="column.backgroundColor || selectedComponent.options.rowBackgroundColor || '#ffffff'" title="背景颜色" @input="updateTableColumn(index, 'backgroundColor', inputValue($event))" />
              </div>
              <input class="column-colspan" type="number" min="1" :value="column.colspan || 1" title="表体横向合并列数（colspan），覆盖后续列" @input="updateTableColumn(index, 'colspan', inputNumber($event))" />
            </div>
            <button class="add-col-btn" @click="addTableColumn">+ 添加列</button>
            <div class="field-hint">多行分组表头在模板 JSON 中用 <code>columns[].children</code> 配置；"合" 开启纵向合并相同值（分页时页边界截断）；"跨列" 设置表体横向合并（colspan），覆盖后续列。</div>
          </div>

          <div class="subsection-title">条件样式</div>
          <div class="columns-config">
            <div v-for="(rule, index) in tableCellRules" :key="index" class="rule-item">
              <select class="rule-scope" :value="rule.scope || 'cell'" @change="updateTableRule(index, 'scope', inputValue($event))">
                <option value="cell">单元格</option>
                <option value="row">整行</option>
              </select>
              <input type="text" :value="rule.field || ''" :placeholder="rule.scope === 'row' ? '字段名(必填)' : '字段名(默认当前列)'" @input="updateTableRule(index, 'field', inputValue($event))" />
              <select class="rule-op" :value="rule.op || 'eq'" @change="updateTableRule(index, 'op', inputValue($event))">
                <option value="eq">等于</option>
                <option value="ne">不等于</option>
                <option value="gt">大于</option>
                <option value="gte">大于等于</option>
                <option value="lt">小于</option>
                <option value="lte">小于等于</option>
                <option value="contains">包含</option>
                <option value="empty">为空</option>
                <option value="notEmpty">非空</option>
              </select>
              <input type="text" :value="rule.value ?? ''" placeholder="值" @input="updateTableRule(index, 'value', inputValue($event))" />
              <input type="color" class="rule-color" :value="rule.color || '#000000'" title="文字颜色" @input="updateTableRule(index, 'color', inputValue($event))" />
              <input type="color" class="rule-color" :value="rule.backgroundColor || '#ffffff'" title="背景颜色" @input="updateTableRule(index, 'backgroundColor', inputValue($event))" />
              <button class="remove-col-btn" @click="removeTableRule(index)">x</button>
            </div>
            <button class="add-col-btn" @click="addTableRule">+ 添加规则</button>
            <div class="field-hint">按数据取值自动套样式："单元格"只作用于取值列的单元格（字段留空按当前列取值），"整行"作用于整行（需填字段）。例：金额小于 0 标红 = 单元格 / amount / 小于 / 0 / 红色。</div>
          </div>
        </div>

        <div v-if="selectedComponent.type === 'qrcode'" class="property-section">
          <div class="section-title">二维码属性</div>
          <div v-if="codeValidation" class="code-validation-warning">
            <span class="warning-icon">!</span>
            {{ codeValidation.message }}
          </div>
          <div class="property-item full-width">
            <label>内容</label>
            <textarea :value="selectedComponent.options.content" rows="2" placeholder="支持 {{field}} 绑定" @input="updateOption('content', inputValue($event))"></textarea>
          </div>
          <div class="field-hint">使用 <code v-pre>{{fieldName}}</code> 语法绑定数据字段</div>
          <div class="property-item">
            <label>纠错级别</label>
            <select :value="selectedComponent.options.level || 'M'" @change="updateOption('level', inputValue($event))">
              <option value="L">低 (L)</option>
              <option value="M">中 (M)</option>
              <option value="Q">较高 (Q)</option>
              <option value="H">高 (H)</option>
            </select>
          </div>
          <div class="property-item">
            <label>留白</label>
            <input type="number" min="0" :value="selectedComponent.options.margin ?? 1" @input="updateOption('margin', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>码色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.darkColor || '#000000'" @input="updateOption('darkColor', inputValue($event))" />
              <span>{{ selectedComponent.options.darkColor || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>背景</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.lightColor || '#ffffff'" @input="updateOption('lightColor', inputValue($event))" />
              <span>{{ selectedComponent.options.lightColor || '#ffffff' }}</span>
            </div>
          </div>
        </div>

        <div v-if="selectedComponent.type === 'barcode'" class="property-section">
          <div class="section-title">条码属性</div>
          <div v-if="codeValidation" class="code-validation-warning">
            <span class="warning-icon">!</span>
            {{ codeValidation.message }}
          </div>
          <div class="property-item full-width">
            <label>内容</label>
            <textarea :value="selectedComponent.options.content" rows="2" placeholder="支持 {{field}} 绑定" @input="updateOption('content', inputValue($event))"></textarea>
          </div>
          <div class="field-hint">使用 <code v-pre>{{fieldName}}</code> 语法绑定数据字段</div>
          <div class="property-item">
            <label>格式</label>
            <select :value="selectedComponent.options.format || 'CODE128'" @change="updateOption('format', inputValue($event))">
              <option value="CODE128">CODE128</option>
              <option value="CODE39">CODE39</option>
              <option value="EAN13">EAN13</option>
              <option value="EAN8">EAN8</option>
              <option value="UPC">UPC</option>
              <option value="ITF">ITF</option>
            </select>
          </div>
          <div class="property-item">
            <label>显示文字</label>
            <input type="checkbox" :checked="selectedComponent.options.displayValue ?? true" @change="updateOption('displayValue', inputChecked($event))" />
          </div>
          <div class="property-item">
            <label>线宽</label>
            <input type="number" min="0.5" step="0.1" :value="selectedComponent.options.barWidth || 1.5" @input="updateOption('barWidth', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>条高</label>
            <input type="number" min="1" :value="selectedComponent.options.barHeight || 40" @input="updateOption('barHeight', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>字体大小</label>
            <input type="number" min="1" :value="selectedComponent.options.fontSize || 12" @input="updateOption('fontSize', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>文字位置</label>
            <div class="segmented">
              <button type="button" :class="{ active: selectedComponent.options.textPosition === 'top' }" @click="updateOption('textPosition', 'top')">上</button>
              <button type="button" :class="{ active: (selectedComponent.options.textPosition || 'bottom') === 'bottom' }" @click="updateOption('textPosition', 'bottom')">下</button>
            </div>
          </div>
          <div class="property-item">
            <label>文字对齐</label>
            <div class="segmented">
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'left' }" @click="updateOption('textAlign', 'left')">左</button>
              <button type="button" :class="{ active: (selectedComponent.options.textAlign || 'center') === 'center' }" @click="updateOption('textAlign', 'center')">中</button>
              <button type="button" :class="{ active: selectedComponent.options.textAlign === 'right' }" @click="updateOption('textAlign', 'right')">右</button>
            </div>
          </div>
          <div class="property-item">
            <label>文字间距</label>
            <input type="number" min="0" :value="selectedComponent.options.textMargin ?? 2" @input="updateOption('textMargin', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>边距</label>
            <input type="number" min="0" :value="selectedComponent.options.margin ?? 0" @input="updateOption('margin', inputNumber($event))" />
          </div>
          <div class="property-item">
            <label>线条色</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.lineColor || '#000000'" @input="updateOption('lineColor', inputValue($event))" />
              <span>{{ selectedComponent.options.lineColor || '#000000' }}</span>
            </div>
          </div>
          <div class="property-item">
            <label>背景</label>
            <div class="color-field">
              <input type="color" :value="selectedComponent.options.background || '#ffffff'" @input="updateOption('background', inputValue($event))" />
              <span>{{ selectedComponent.options.background || '#ffffff' }}</span>
            </div>
          </div>
        </div>

        <div class="property-section">
          <button class="delete-btn" @click="$emit('delete')">删除组件</button>
        </div>
      </template>

      <div v-else class="empty-state">
        <p>请选择一个组件</p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HPrintComponent, TableOptions } from '../core/types'
import * as QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

const props = defineProps<{
  selectedComponent: HPrintComponent | null
  selectedComponents: HPrintComponent[]
}>()

const emit = defineEmits<{
  (e: 'update', id: string, updates: Partial<HPrintComponent>): void
  (e: 'batch-update', ids: string[], updates: Partial<HPrintComponent>): void
  (e: 'batch-scale', ids: string[], scaleX: number, scaleY: number): void
  (e: 'delete'): void
}>()

const tableColumns = computed(() => {
  const columns = props.selectedComponent?.options?.columns
  return Array.isArray(columns) ? columns : []
})

const componentTypeLabel = computed(() => {
  const type = props.selectedComponent?.type
  const labels: Record<string, string> = {
    text: '文本',
    line: '线条',
    rect: '矩形',
    ellipse: '椭圆',
    image: '图片',
    table: '表格',
    qrcode: '二维码',
    barcode: '条码',
    'page-header': '页眉',
    'page-footer': '页脚',
    'page-number': '页码',
    watermark: '水印',
    'receipt-title': '旧小票标题',
    'receipt-text': '旧小票文本',
    'receipt-keyvalue': '旧小票键值',
    'receipt-divider': '旧小票分割线',
    'receipt-total': '旧小票合计',
    'receipt-qrcode': '旧小票二维码',
    'receipt-barcode': '旧小票条码',
  }
  return type ? labels[type] || type : ''
})

const imagePosition = computed(() => {
  return props.selectedComponent?.options?.objectPosition || 'center center'
})

const textSectionTitle = computed(() => {
  const type = props.selectedComponent?.type
  if (type === 'page-header') return '页眉属性'
  if (type === 'page-footer') return '页脚属性'
  if (type === 'page-number') return '页码属性'
  if (type === 'watermark') return '水印属性'
  return '文本属性'
})

const codeValidation = computed(() => {
  const comp = props.selectedComponent
  if (!comp) return null
  if (comp.type !== 'qrcode' && comp.type !== 'barcode') return null
  const content = String(comp.options?.content ?? '').trim()
  if (!content) return null

  if (comp.type === 'qrcode') {
    try {
      QRCode.create(content, { errorCorrectionLevel: comp.options?.level || 'M' })
      return null
    } catch (e) {
      return { level: 'error' as const, message: `二维码生成失败: ${(e as Error).message}` }
    }
  }

  if (comp.type === 'barcode') {
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(svg, content, { format: comp.options?.format || 'CODE128', displayValue: false })
      return null
    } catch (e) {
      return { level: 'error' as const, message: `条码生成失败: ${(e as Error).message}` }
    }
  }
  return null
})

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
}

function inputNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}

function inputChecked(event: Event): boolean {
  return (event.target as HTMLInputElement).checked
}

function updateField(field: string, value: unknown) {
  if (!props.selectedComponent) return
  emit('update', props.selectedComponent.id, { [field]: value })
}

function updateOption(field: string, value: unknown) {
  if (!props.selectedComponent) return
  emit('update', props.selectedComponent.id, {
    options: { ...props.selectedComponent.options, [field]: value },
  })
}

function updateTableColumn(index: number, field: string, value: unknown) {
  if (!props.selectedComponent) return
  const columns = [...tableColumns.value]
  columns[index] = { ...columns[index], [field]: value }
  updateOption('columns', columns)
}

function addTableColumn() {
  if (!props.selectedComponent) return
  const columns: NonNullable<TableOptions['columns']> = [
    ...tableColumns.value,
    { field: 'field', title: '标题', width: 80, align: 'left' },
  ]
  updateOption('columns', columns)
}

function removeTableColumn(index: number) {
  if (!props.selectedComponent) return
  const columns = tableColumns.value.filter((_, i) => i !== index)
  updateOption('columns', columns)
}

const tableCellRules = computed(() => {
  const rules = props.selectedComponent?.options?.cellRules
  return Array.isArray(rules) ? rules : []
})

function updateTableRule(index: number, field: string, value: unknown) {
  if (!props.selectedComponent) return
  const rules = [...tableCellRules.value]
  rules[index] = { ...rules[index], [field]: value }
  updateOption('cellRules', rules)
}

function addTableRule() {
  if (!props.selectedComponent) return
  updateOption('cellRules', [
    ...tableCellRules.value,
    { scope: 'cell', op: 'lt', value: 0, color: '#d0021b' },
  ])
}

function removeTableRule(index: number) {
  if (!props.selectedComponent) return
  updateOption('cellRules', tableCellRules.value.filter((_, i) => i !== index))
}

function resetImageCrop() {
  if (!props.selectedComponent) return
  updateOption('cropX', 0)
  updateOption('cropY', 0)
  updateOption('cropWidth', 100)
  updateOption('cropHeight', 100)
}

function batchUpdateField(field: string, value: unknown) {
  if (props.selectedComponents.length < 2) return
  emit('batch-update', props.selectedComponents.map(c => c.id), { [field]: value })
}

const scaleInputRef = ref<HTMLInputElement>()

function applyBatchScale() {
  if (props.selectedComponents.length < 2) return
  const scalePercent = Number(scaleInputRef.value?.value || 100)
  if (scalePercent <= 0 || scalePercent === 100) return
  const factor = scalePercent / 100
  emit('batch-scale', props.selectedComponents.map(c => c.id), factor, factor)
}

function batchUpdateOption(field: string, value: unknown) {
  if (props.selectedComponents.length < 2) return
  const ids = props.selectedComponents.map(c => c.id)
  emit('batch-update', ids, {
    options: { [field]: value },
  })
}

function batchValue(field: string, fallback?: unknown): unknown {
  if (props.selectedComponents.length < 2) return fallback ?? null
  const values = props.selectedComponents.map(c => (c as any)[field])
  const first = values[0]
  if (values.every(v => v === first)) return first
  return fallback ?? null
}

function batchPlaceholder(field: string): string {
  const vals = props.selectedComponents.map(c => (c as any)[field])
  const unique = [...new Set(vals)]
  if (unique.length === 1) return String(unique[0])
  return '混合'
}

function batchOptionValue(field: string): unknown {
  if (props.selectedComponents.length < 2) return null
  const values = props.selectedComponents.map(c => c.options?.[field])
  const first = values[0]
  if (values.every(v => v === first)) return first
  return null
}

function batchOptionPlaceholder(field: string): string {
  const vals = props.selectedComponents.map(c => c.options?.[field])
  const unique = [...new Set(vals)]
  if (unique.length === 1) return String(unique[0])
  return '混合'
}

function batchHasType(type: string): boolean {
  return props.selectedComponents.some(c => c.type === type)
}

function batchAllSameType(type: string): boolean {
  return props.selectedComponents.length >= 2 && props.selectedComponents.every(c => c.type === type)
}
</script>

<style scoped>
.property-panel {
  width: 320px;
  background: #fff;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}
.panel-header {
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}
.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}
.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
}
.component-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  margin-bottom: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.component-type {
  padding: 2px 8px;
  border-radius: 999px;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 12px;
  font-weight: 600;
}
.component-id {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.batch-summary .component-type {
  background: #fff7e6;
  color: #d48806;
}
.property-section {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid #edf2f7;
  border-radius: 6px;
  background: #fff;
}
.property-section:last-child {
  margin-bottom: 0;
}
.section-title,
.subsection-title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 10px;
}
.subsection-title {
  margin-top: 15px;
}
.property-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.property-item.full-width {
  flex-direction: column;
  align-items: flex-start;
}
.property-item.full-width label {
  margin-bottom: 5px;
}
.property-item.full-width input,
.property-item.full-width select,
.property-item.full-width textarea {
  width: 100%;
}
.property-item label {
  width: 72px;
  font-size: 12px;
  color: #475569;
  flex-shrink: 0;
}
.input-with-unit {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
}
.input-with-unit input {
  border-top-right-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
}
.input-with-unit span {
  height: 30px;
  min-width: 38px;
  padding: 0 8px;
  border: 1px solid #dcdfe6;
  border-left: none;
  border-radius: 0 4px 4px 0;
  background: #f8fafc;
  color: #64748b;
  font-size: 11px;
  line-height: 28px;
  text-align: center;
}
.property-item input[type="number"],
.property-item input[type="text"],
.property-item select,
.property-item textarea {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}
.range-input {
  flex: 1;
  min-width: 0;
}
.value-text {
  width: 42px;
  color: #64748b;
  font-size: 12px;
  text-align: right;
}
.property-item input[type="number"]:focus,
.property-item input[type="text"]:focus,
.property-item select:focus,
.property-item textarea:focus {
  border-color: #409eff;
}
.property-item textarea {
  width: 100%;
  resize: vertical;
  min-height: 60px;
  font-family: Consolas, Monaco, monospace;
}
.property-item input[type="color"] {
  width: 34px;
  height: 30px;
  padding: 2px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
}
.color-field {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
}
.color-field span {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: #f8fafc;
  color: #475569;
  font-family: Consolas, Monaco, monospace;
  font-size: 11px;
}
.segmented {
  display: grid;
  flex: 1;
  min-width: 0;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}
.segmented button {
  min-width: 0;
  height: 30px;
  border: none;
  border-right: 1px solid #dcdfe6;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
}
.segmented button:last-child {
  border-right: none;
}
.segmented button:hover,
.segmented button.active {
  background: #ecf5ff;
  color: #409eff;
}
.position-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.position-grid button {
  height: 28px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 13px;
}
.position-grid button:hover,
.position-grid button.active {
  border-color: #409eff;
  background: #ecf5ff;
  color: #409eff;
}
.property-item input[type="checkbox"] {
  width: 14px;
  height: 14px;
}
.field-hint {
  font-size: 11px;
  color: #909399;
  margin-bottom: 10px;
  padding: 6px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
.field-hint code {
  background: #e6f7ff;
  padding: 1px 4px;
  border-radius: 2px;
  color: #1890ff;
  font-size: 11px;
}
.columns-config {
  background: #f5f7fa;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
.column-item {
  display: grid;
  grid-template-columns: 1fr 1fr 56px 54px 24px 24px;
  gap: 4px;
  margin-bottom: 6px;
}
.column-item input,
.column-item select {
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 11px;
  background: #fff;
}
.column-item input {
  flex: 1;
}
.column-width {
  width: 52px;
  flex: none !important;
}
.column-align {
  width: 48px;
  flex: none;
}
.column-font-size,
.column-weight {
  grid-column: span 2;
}
.column-color-field {
  display: grid;
  grid-column: span 3;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}
.column-colspan {
  grid-column: span 2;
  width: 64px;
  flex: none !important;
}
.rule-item {
  display: grid;
  grid-template-columns: 62px 1fr 72px 1fr 26px 26px 22px;
  gap: 4px;
  margin-bottom: 6px;
}
.rule-item input,
.rule-item select {
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 11px;
  background: #fff;
}
.rule-item .rule-color {
  width: 100%;
  height: 24px;
  padding: 2px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
}
.column-color-field input[type="color"] {
  width: 100%;
  height: 24px;
  padding: 2px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
}
.merge-col-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #909399;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.merge-col-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.remove-col-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: #f56c6c;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
}
.add-col-btn {
  width: 100%;
  padding: 6px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  cursor: pointer;
  font-size: 11px;
  margin-top: 4px;
}
.add-col-btn:hover {
  color: #409eff;
  border-color: #409eff;
}
.delete-btn {
  width: 100%;
  padding: 8px;
  background: #fff;
  border: 1px solid #f56c6c;
  border-radius: 4px;
  color: #f56c6c;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}
.delete-btn:hover {
  background: #f56c6c;
  color: #fff;
}
.code-validation-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  margin-bottom: 10px;
  border: 1px solid #fde2e2;
  border-radius: 4px;
  background: #fef0f0;
  color: #f56c6c;
  font-size: 11px;
}
.warning-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f56c6c;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.scale-control {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 4px;
}
.scale-control input {
  width: 60px;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
}
.scale-control span {
  color: #64748b;
  font-size: 11px;
}
.scale-apply-btn {
  padding: 3px 8px;
  border: 1px solid #409eff;
  border-radius: 4px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 11px;
  cursor: pointer;
}
.scale-apply-btn:hover { background: #409eff; color: #fff; }
.reset-crop-btn {
  padding: 4px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  color: #606266;
  font-size: 12px;
  cursor: pointer;
}
.reset-crop-btn:hover { color: #409eff; border-color: #409eff; }
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #999;
  font-size: 14px;
}
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  cursor: pointer;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #dcdfe6;
  border-radius: 20px;
  transition: background 0.2s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 16px; height: 16px;
  left: 2px; bottom: 2px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
.toggle-switch input:checked + .toggle-slider { background: #409eff; }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }
</style>
