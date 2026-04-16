// content.js — Симуляция дальтонизма + проверка доступности (ГОСТ Р 52872-2019).
// v7.0 — Исправлены ложные срабатывания: обход DOM для фона, контекст ссылок, box-shadow/outline для UI

if (!window.__vsLoaded) {
  window.__vsLoaded = true;

  // ============================================================
  // ЧАСТЬ 1: Симуляция дальтонизма
  // ============================================================
  var COLOR_MATRICES = {
    protanopia: [
      0.152286,1.052583,-0.204868,0,0,
      0.114503,0.786281,0.099216,0,0,
      -0.003882,-0.048116,1.051998,0,0,
      0,0,0,1,0
    ],
    deuteranopia: [
      0.367322,0.860646,-0.227968,0,0,
      0.280085,0.672501,0.047413,0,0,
      -0.011820,0.042940,0.968881,0,0,
      0,0,0,1,0
    ],
    tritanopia: [
      1.255528,-0.076749,-0.178779,0,0,
      -0.078411,0.930809,0.147602,0,0,
      0.004733,0.691367,0.303900,0,0,
      0,0,0,1,0
    ],
    achromatopsia: [
      0.2126,0.7152,0.0722,0,0,
      0.2126,0.7152,0.0722,0,0,
      0.2126,0.7152,0.0722,0,0,
      0,0,0,1,0
    ]
  };

  var SVG_ID = 'vs-svg';
  var FILTER_ID = 'vs-filter';
  var activeModes = [];

  function buildColorFilter(modes) {
    var old = document.getElementById(SVG_ID);
    if (old) old.remove();
    if (modes.length === 0) return;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.id = SVG_ID;
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    var filter = document.createElementNS(svgNS, 'filter');
    filter.id = FILTER_ID;
    filter.setAttribute('color-interpolation-filters', 'linearRGB');
    modes.forEach(function(m, i) {
      var mx = COLOR_MATRICES[m]; if (!mx) return;
      var fe = document.createElementNS(svgNS, 'feColorMatrix');
      fe.setAttribute('type', 'matrix');
      fe.setAttribute('values', mx.join(' '));
      fe.setAttribute('in', i === 0 ? 'SourceGraphic' : 'step' + (i - 1));
      fe.setAttribute('result', 'step' + i);
      filter.appendChild(fe);
    });
    svg.appendChild(filter);
    document.body.insertBefore(svg, document.body.firstChild);
  }

  function applyModes() {
    document.documentElement.style.filter = '';
    var old = document.getElementById(SVG_ID);
    if (old) old.remove();
    if (activeModes.length === 0) return;
    var colorModes = activeModes.filter(function(m) { return !!COLOR_MATRICES[m]; });
    buildColorFilter(colorModes);
    if (colorModes.length > 0) {
      document.documentElement.style.filter = 'url(#' + FILTER_ID + ')';
    }
  }

  // ============================================================
  // ЧАСТЬ 2: Проверка доступности (ГОСТ Р 52872-2019 / WCAG 2.1)
  // ============================================================

  // --- Утилиты для работы с цветом ---

  function sRGBtoLinear(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(r, g, b) {
    return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
  }

  function contrastRatio(l1, l2) {
    var lighter = Math.max(l1, l2);
    var darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function parseColor(str) {
    if (!str) return null;
    var m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
    return null;
  }

  function getAlpha(str) {
    if (!str) return 1;
    var m = str.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : 1;
  }

  // --- FIX 1: Обход DOM вверх для поиска реального фона ---
  // Если у элемента прозрачный фон, поднимаемся по дереву до непрозрачного
  function getEffectiveBackground(el) {
    var maxDepth = 10;
    var current = el;
    while (current && maxDepth-- > 0) {
      var style = window.getComputedStyle(current);
      var bgColor = style.backgroundColor;
      var alpha = getAlpha(bgColor);
      if (alpha > 0.1) {
        var parsed = parseColor(bgColor);
        if (parsed) return parsed;
      }
      current = current.parentElement;
    }
    // Если ничего не нашли — считаем белый фон (наиболее частый случай)
    return { r: 255, g: 255, b: 255 };
  }

  // --- FIX 2: Проверка, является ли элемент видимым ---
  function isVisible(el) {
    var style = window.getComputedStyle(el);
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           parseFloat(style.opacity) > 0.01 &&
           el.offsetWidth > 0 &&
           el.offsetHeight > 0;
  }

  // --- FIX 3: Проверка навигационного контекста для ссылок ---
  function isInNavigationContext(el) {
    var current = el;
    var maxDepth = 8;
    while (current && maxDepth-- > 0) {
      var tag = current.tagName ? current.tagName.toLowerCase() : '';
      // Навигационные теги
      if (tag === 'nav' || tag === 'header' || tag === 'footer') return true;
      // ARIA-роли навигации
      var role = current.getAttribute ? current.getAttribute('role') : '';
      if (role === 'navigation' || role === 'menu' || role === 'menubar' ||
          role === 'tablist' || role === 'toolbar' || role === 'banner' ||
          role === 'contentinfo') return true;
      // Типичные CSS-классы навигации
      var cls = (current.className && typeof current.className === 'string') ? current.className.toLowerCase() : '';
      if (cls.match(/\b(nav|menu|navbar|header|footer|breadcrumb|sidebar|toolbar|pagination)\b/)) return true;
      current = current.parentElement;
    }
    return false;
  }

  // --- FIX 4: Проверка, стилизована ли ссылка как кнопка ---
  function isStyledAsButton(el) {
    var style = window.getComputedStyle(el);
    var bgAlpha = getAlpha(style.backgroundColor);
    var bg = parseColor(style.backgroundColor);
    // Имеет непрозрачный фон, отличный от белого/прозрачного
    if (bgAlpha > 0.3 && bg) {
      var lum = luminance(bg.r, bg.g, bg.b);
      // Фон не белый и не почти белый
      if (lum < 0.9) return true;
    }
    // Имеет видимую рамку со всех сторон
    var bw = parseFloat(style.borderWidth);
    if (bw >= 1) {
      var bc = parseColor(style.borderColor);
      if (bc) {
        var parentBg = getEffectiveBackground(el.parentElement);
        var borderL = luminance(bc.r, bc.g, bc.b);
        var parentL = luminance(parentBg.r, parentBg.g, parentBg.b);
        if (contrastRatio(borderL, parentL) >= 2) return true;
      }
    }
    // Имеет border-radius (выглядит как кнопка)
    var br = parseFloat(style.borderRadius);
    if (br >= 4 && bgAlpha > 0.1) return true;
    return false;
  }

  // --- FIX 5: Проверка визуальной границы UI-элемента (box-shadow, outline, фон) ---
  function hasVisualBoundary(el) {
    var style = window.getComputedStyle(el);

    // 1. Проверяем border
    var bw = parseFloat(style.borderWidth);
    if (bw >= 1) {
      var bc = parseColor(style.borderColor);
      var bgI = parseColor(style.backgroundColor);
      var parentBg = getEffectiveBackground(el.parentElement);
      if (bc) {
        var borderL = luminance(bc.r, bc.g, bc.b);
        var parentL = luminance(parentBg.r, parentBg.g, parentBg.b);
        if (contrastRatio(borderL, parentL) >= 3) return true;
      }
    }

    // 2. Проверяем box-shadow (часто используется вместо border)
    var shadow = style.boxShadow;
    if (shadow && shadow !== 'none') {
      // Парсим цвет из box-shadow
      var shadowColor = parseColor(shadow);
      if (shadowColor) {
        var shadowL = luminance(shadowColor.r, shadowColor.g, shadowColor.b);
        var parentBg2 = getEffectiveBackground(el.parentElement);
        var parentL2 = luminance(parentBg2.r, parentBg2.g, parentBg2.b);
        if (contrastRatio(shadowL, parentL2) >= 2) return true;
      } else {
        // Если не удалось распарсить, но shadow есть — считаем валидным
        return true;
      }
    }

    // 3. Проверяем outline
    var outlineWidth = parseFloat(style.outlineWidth);
    var outlineStyle = style.outlineStyle;
    if (outlineWidth >= 1 && outlineStyle !== 'none') return true;

    // 4. Проверяем контраст фона элемента к фону родителя
    var elBg = parseColor(style.backgroundColor);
    var elBgAlpha = getAlpha(style.backgroundColor);
    if (elBg && elBgAlpha > 0.3) {
      var parentBg3 = getEffectiveBackground(el.parentElement);
      var elBgL = luminance(elBg.r, elBg.g, elBg.b);
      var parentL3 = luminance(parentBg3.r, parentBg3.g, parentBg3.b);
      if (contrastRatio(elBgL, parentL3) >= 1.5) return true;
    }

    return false;
  }

  // ============================================================
  // АУДИТ
  // ============================================================

  function runAudit() {
    var results = [];

    // --- Проверка 1: Контрастность текста (ГОСТ 1.4.3) ---
    // FIX: используем getEffectiveBackground для обхода DOM вверх
    var textEls = document.querySelectorAll('p, span, a, h1, h2, h3, h4, h5, h6, li, td, th, label, div, button');
    var lowContrastCount = 0;
    var totalChecked = 0;
    var worstRatio = 999;
    var limit = Math.min(textEls.length, 2000);

    for (var i = 0; i < limit; i++) {
      var el = textEls[i];
      var text = el.textContent || '';
      if (text.trim().length === 0) continue;
      if (el.children.length > 3) continue;
      if (!isVisible(el)) continue;

      var style = window.getComputedStyle(el);
      var fg = parseColor(style.color);
      if (!fg) continue;

      // FIX: получаем эффективный фон с обходом DOM
      var bg = getEffectiveBackground(el);

      totalChecked++;
      var fgL = luminance(fg.r, fg.g, fg.b);
      var bgL = luminance(bg.r, bg.g, bg.b);
      var ratio = contrastRatio(fgL, bgL);

      var fontSize = parseFloat(style.fontSize);
      var isBold = parseInt(style.fontWeight) >= 700 || style.fontWeight === 'bold';
      var isLarge = fontSize >= 24 || (isBold && fontSize >= 18.66);
      var minRatio = isLarge ? 3 : 4.5;

      if (ratio < minRatio) lowContrastCount++;
      if (ratio < worstRatio) worstRatio = ratio;
    }

    if (totalChecked > 0) {
      var st = lowContrastCount === 0 ? 'pass' : lowContrastCount <= 3 ? 'warn' : 'fail';
      results.push({
        title: 'Контрастность текста',
        status: st,
        detail: 'Проверено элементов: ' + totalChecked + '. Недостаточный контраст: ' + lowContrastCount +
                '. Минимальный найденный коэффициент: ' + worstRatio.toFixed(1) + ':1 (требуется \u22654.5:1).',
        ref: 'ГОСТ Р 52872-2019, п. 1.4.3 / WCAG 2.1 SC 1.4.3'
      });
    }

    // --- Проверка 2: Размер шрифта (ГОСТ 1.4.4) ---
    var smallFontCount = 0;
    var fontChecked = 0;
    for (var j = 0; j < limit; j++) {
      var el2 = textEls[j];
      if ((el2.textContent || '').trim().length === 0) continue;
      if (el2.children.length > 3) continue;
      if (!isVisible(el2)) continue;
      var fs = parseFloat(window.getComputedStyle(el2).fontSize);
      if (fs > 0) {
        fontChecked++;
        if (fs < 12) smallFontCount++;
      }
    }
    results.push({
      title: 'Размер шрифта',
      status: smallFontCount === 0 ? 'pass' : smallFontCount <= 5 ? 'warn' : 'fail',
      detail: 'Элементов с шрифтом менее 12px: ' + smallFontCount + ' из ' + fontChecked +
              '. Рекомендуется минимум 12px (лучше 14-16px) для читаемости.',
      ref: 'ГОСТ Р 52872-2019, п. 1.4.4 / WCAG 2.1 SC 1.4.4'
    });

    // --- Проверка 3: Alt-тексты у изображений (ГОСТ 1.1.1) ---
    // FIX: исключаем декоративные изображения (role=presentation, aria-hidden, трекинг-пиксели)
    var imgs = document.querySelectorAll('img');
    var noAltCount = 0;
    var emptyAltCount = 0;
    var skippedDecorative = 0;
    imgs.forEach(function(img) {
      // Пропускаем декоративные изображения
      var role = img.getAttribute('role');
      if (role === 'presentation' || role === 'none') { skippedDecorative++; return; }
      if (img.getAttribute('aria-hidden') === 'true') { skippedDecorative++; return; }
      // Пропускаем трекинг-пиксели (1x1 или очень маленькие)
      if (img.naturalWidth <= 2 && img.naturalHeight <= 2) { skippedDecorative++; return; }
      if (img.width <= 2 && img.height <= 2) { skippedDecorative++; return; }
      // Пропускаем невидимые
      if (!isVisible(img)) { skippedDecorative++; return; }

      if (!img.hasAttribute('alt')) noAltCount++;
      else if (img.alt.trim() === '') emptyAltCount++;
    });
    var imgTotal = imgs.length - skippedDecorative;
    var altStatus = noAltCount === 0 ? 'pass' : noAltCount <= 3 ? 'warn' : 'fail';
    results.push({
      title: 'Alt-тексты изображений',
      status: altStatus,
      detail: 'Всего изображений: ' + imgTotal + ' (декоративных пропущено: ' + skippedDecorative +
              '). Без атрибута alt: ' + noAltCount + '. С пустым alt: ' + emptyAltCount + '.',
      ref: 'ГОСТ Р 52872-2019, п. 1.1.1 / WCAG 2.1 SC 1.1.1'
    });

    // --- Проверка 4: Межстрочный интервал (ГОСТ 1.4.12) ---
    // FIX: проверяем только контентные блоки (не навигацию, не заголовки)
    var paragraphs = document.querySelectorAll('p, li, td, div');
    var badLineHeight = 0;
    var lhChecked = 0;
    var lhLimit = Math.min(paragraphs.length, 300);
    for (var k = 0; k < lhLimit; k++) {
      var elP = paragraphs[k];
      var pText = (elP.textContent || '').trim();
      if (pText.length < 20) continue;
      if (elP.children.length > 5) continue;
      if (!isVisible(elP)) continue;
      // FIX: пропускаем навигационные элементы — line-height там менее критичен
      if (isInNavigationContext(elP)) continue;
      var stP = window.getComputedStyle(elP);
      var lh = parseFloat(stP.lineHeight);
      var fsz = parseFloat(stP.fontSize);
      if (lh > 0 && fsz > 0) {
        lhChecked++;
        var ratio2 = lh / fsz;
        if (ratio2 < 1.5) badLineHeight++;
      }
    }
    results.push({
      title: 'Межстрочный интервал',
      status: badLineHeight === 0 ? 'pass' : badLineHeight <= 5 ? 'warn' : 'fail',
      detail: 'Проверено блоков: ' + lhChecked + '. С интервалом менее 1.5: ' + badLineHeight +
              '. Рекомендуется line-height \u2265 1.5 от размера шрифта.',
      ref: 'ГОСТ Р 52872-2019, п. 1.4.12 / WCAG 2.1 SC 1.4.12'
    });

    // --- Проверка 5: Выравнивание текста по ширине (ГОСТ 1.4.8) ---
    var justifiedCount = 0;
    for (var m2 = 0; m2 < lhLimit; m2++) {
      var elJ = paragraphs[m2];
      if ((elJ.textContent || '').trim().length < 20) continue;
      var ta = window.getComputedStyle(elJ).textAlign;
      if (ta === 'justify') justifiedCount++;
    }
    results.push({
      title: 'Выравнивание по ширине',
      status: justifiedCount === 0 ? 'pass' : 'warn',
      detail: 'Элементов с text-align: justify: ' + justifiedCount +
              '. Рекомендуется не использовать выравнивание по ширине — оно затрудняет чтение для слабовидящих.',
      ref: 'ГОСТ Р 52872-2019, п. 1.4.8 / WCAG 2.1 SC 1.4.8'
    });

    // --- Проверка 6: Ссылки различимы не только цветом (ГОСТ 1.4.1) ---
    // FIX: учитываем навигационный контекст, стилизацию кнопкой, контраст цвета ссылки к тексту
    var links = document.querySelectorAll('a');
    var colorOnlyLinks = 0;
    var totalLinks = 0;
    var skippedNavLinks = 0;
    links.forEach(function(a) {
      var linkText = (a.textContent || '').trim();
      if (linkText.length === 0) return;
      if (!isVisible(a)) return;

      totalLinks++;

      var st3 = window.getComputedStyle(a);

      // 1. Подчёркивание — основной способ различимости
      var hasUnderline = st3.textDecorationLine.indexOf('underline') !== -1;
      if (hasUnderline) return;

      // 2. Рамка снизу (часто используется вместо underline)
      var hasBorder = parseFloat(st3.borderBottomWidth) > 0 &&
                      st3.borderBottomStyle !== 'none';
      if (hasBorder) return;

      // 3. FIX: Ссылка стилизована как кнопка (имеет фон, рамку, border-radius)
      if (isStyledAsButton(a)) return;

      // 4. FIX: Ссылка в навигационном контексте (nav, header, footer, menu)
      // По WCAG, ссылки в навигации не обязаны иметь подчёркивание,
      // если контекст делает их очевидно кликабельными
      if (isInNavigationContext(a)) {
        skippedNavLinks++;
        return;
      }

      // 5. FIX: Ссылка имеет иконку (img, svg, i с классом icon внутри)
      var hasIcon = a.querySelector('img, svg, i[class*="icon"], i[class*="fa-"], span[class*="icon"]');
      if (hasIcon) return;

      // 6. FIX: Ссылка содержит только изображение (image link)
      if (a.querySelector('img') && linkText === a.querySelector('img').alt) return;

      // Если ничего из вышеперечисленного — это ссылка, различимая только цветом
      colorOnlyLinks++;
    });

    results.push({
      title: 'Различимость ссылок',
      status: colorOnlyLinks === 0 ? 'pass' : colorOnlyLinks <= 5 ? 'warn' : 'fail',
      detail: 'Ссылок без визуального отличия (кроме цвета): ' + colorOnlyLinks + ' из ' + totalLinks +
              ' (навигационных пропущено: ' + skippedNavLinks + ').' +
              ' Ссылки в основном контенте не должны отличаться от текста только цветом.',
      ref: 'ГОСТ Р 52872-2019, п. 1.4.1 / WCAG 2.1 SC 1.4.1'
    });

    // --- Проверка 7: Контрастность нетекстовых элементов (ГОСТ 1.4.11) ---
    // FIX: учитываем box-shadow, outline и контраст фона к родителю
    var inputs = document.querySelectorAll('input, select, textarea, button');
    var lowContrastUI = 0;
    var totalUI = 0;
    inputs.forEach(function(inp) {
      if (!isVisible(inp)) return;
      // FIX: пропускаем скрытые input (type=hidden)
      if (inp.type === 'hidden') return;
      totalUI++;

      if (hasVisualBoundary(inp)) return;

      lowContrastUI++;
    });

    results.push({
      title: 'Контрастность UI-элементов',
      status: lowContrastUI === 0 ? 'pass' : lowContrastUI <= 3 ? 'warn' : 'fail',
      detail: 'Элементов форм без достаточной визуальной границы: ' + lowContrastUI +
              ' из ' + totalUI + '. Проверяется контраст рамки, box-shadow, outline и фона (\u22653:1).',
      ref: 'ГОСТ Р 52872-2019, п. 1.4.11 / WCAG 2.1 SC 1.4.11'
    });

    return results;
  }

  // ============================================================
  // Слушатель сообщений
  // ============================================================
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.action === 'setModes') {
      activeModes = message.modes || [];
      applyModes();
      sendResponse({ success: true });
    }
    else if (message.action === 'getState') {
      sendResponse({ modes: activeModes });
    }
    else if (message.action === 'runAudit') {
      var results = runAudit();
      sendResponse({ results: results });
    }
    return true;
  });
}
