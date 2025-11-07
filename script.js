// Highlight active section while scrolling
document.addEventListener('scroll', () => {
  const links = document.querySelectorAll('header nav a');
  const fromTop = window.scrollY + 120;
  links.forEach(link => {
    const section = document.querySelector(link.hash);
    if(!section) return;
    if(section.offsetTop <= fromTop && section.offsetTop + section.offsetHeight > fromTop){
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
