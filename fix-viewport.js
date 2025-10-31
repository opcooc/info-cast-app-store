(function() {
    Object.defineProperty(window.screen, 'width', { get: () => 1920 });
    Object.defineProperty(window.screen, 'height', { get: () => 1080 });
    Object.defineProperty(window, 'innerWidth', { get: () => 1920 });
    Object.defineProperty(window, 'innerHeight', { get: () => 1080 });
    Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 });

    const fixLayout = () => {
        const html = document.documentElement;
        const body = document.body;
        if (!html || !body) return;

        html.style.width = '1920px';
        body.style.width = '1920px';
        html.style.overflowX = 'hidden';
        body.style.overflowX = 'hidden';

        const actualWidth = document.documentElement.scrollWidth;
        if (actualWidth > 1920) {
            const scale = 1920 / actualWidth;
            body.style.transform = `scale(${scale})`;
            body.style.transformOrigin = 'top left';
        }
    };

    fixLayout();

    // 等待 document.documentElement 可用再创建 observer
    const waitForDOM = () => {
        if (document.documentElement) {
            const observer = new MutationObserver(fixLayout);
            observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
        } else {
            requestAnimationFrame(waitForDOM);
        }
    };

    waitForDOM();

    // 定时修正
    setInterval(fixLayout, 500);
})();
