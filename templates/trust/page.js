(function(){
  var $=function(id){return document.getElementById(id)};
  var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CFG=window.__CFG||{};
  var SITE=CFG.site||{};
  var all=function(sel,root){ return [].slice.call((root||document).querySelectorAll(sel)) };

  function smsHref(body){
    if(!SITE.phoneE164) return "";
    return "sms:"+SITE.phoneE164+"?&body="+encodeURIComponent(body||SITE.smsBody||"");
  }

  function tmpl(s,vars){
    return String(s||"").replace(/\{(\w+)\}/g,function(_,k){ return vars[k]==null?"":vars[k] });
  }

  if($("yr")) $("yr").textContent=new Date().getFullYear();


  /* ---------- editable values, written once into every slot ---------- */
  /* A price we have not confirmed is not shown at all. The sentence that would
     carry it stays hidden, so a visitor never reads a stub like "$X,XXX" and
     never reads a sentence with a hole in it either. */
  (function(){
    var VALUES=CFG.priceLines||{};
    all("[data-priceline]").forEach(function(el){
      var key=el.getAttribute("data-priceline"), value=VALUES[key];
      el.hidden=!value;
      var slot=el.querySelector("[data-price-value]");
      if(slot) slot.textContent=value||"";
    });
  })();
  (function(){
    /* A credential with no year behind it does not go on the page. The year is
       never invented, and the claim does not stand on its own without one. */
    all("[data-credential-year]").forEach(function(card){
      var key=card.getAttribute("data-credential-year");
      var year=(CFG.credentialYears||{})[key];
      if(!year) return;
      var slot=card.querySelector("[data-year-value]");
      if(slot) slot.textContent=year;
      card.hidden=false;
    });
  })();

  /* ---------- demo banner ----------
     ?clean=1 shows the page exactly as a real visitor would see it. */
  (function(){
    var bar=$("demobar");
    if(!bar) return;
    var key="fl-demobar-"+(CFG.slug||"demo");
    var dismissed=false;
    try{ dismissed=sessionStorage.getItem(key)==="off" }catch(e){}
    if(new URLSearchParams(location.search).has("clean")||dismissed) return;
    bar.hidden=false;
    document.body.classList.add("has-demobar");
    function sizeBar(){ document.documentElement.style.setProperty("--demobar-h",bar.offsetHeight+"px"); }
    sizeBar();
    window.addEventListener("resize",sizeBar,{passive:true});
    var close=$("demoClose");
    if(close) close.addEventListener("click",function(){
      bar.hidden=true;
      document.body.classList.remove("has-demobar");
      document.documentElement.style.setProperty("--demobar-h","0px");
      try{ sessionStorage.setItem(key,"off") }catch(e){}
    });
  })();

  all("[data-sms]").forEach(function(a){ var h=smsHref(); if(h) a.href=h; });

  function track(ev,p){ try{ if(window.gtag) gtag("event",ev,p||{}); if(window.fbq) fbq("trackCustom",ev,p||{}); }catch(e){} }
  document.addEventListener("click",function(e){
    var a=e.target.closest("a[href^='tel:'],a[href^='mailto:'],a[href^='sms:']");
    if(a) track("generate_lead",{method:a.getAttribute("href").split(":")[0]});
  });


  /* ---------- sticky bar ----------
     The header needs no scroll listener: it is absolutely positioned over the
     hero and simply scrolls away. The only scroll-aware chrome left is the
     mobile call bar below. */
  (function(){
    var bar=$("sticky"), dock=$("calldock"),
        heroEl=$("hero"), enqEl=$("enquire"), heroIn=true, enqIn=false;
    if(!bar&&!dock) return;
    function barSync(){
      var show=!heroIn&&!enqIn;
      if(bar) bar.classList.toggle("on",show);
      if(dock) dock.classList.toggle("on",show);
    }
    if("IntersectionObserver" in window&&heroEl&&enqEl){
      new IntersectionObserver(function(e){ heroIn=e[0].isIntersecting; barSync(); },{threshold:.05}).observe(heroEl);
      new IntersectionObserver(function(e){ enqIn=e[0].isIntersecting; barSync(); },{threshold:.12}).observe(enqEl);
    } else { heroIn=false; barSync(); }
  })();

  /* ---------- masked line reveal ----------------------------------------
     Splits a headline on its authored <br> into lines, each in a clipping
     box with the text inside it. That is what the line-by-line rise needs,
     and it keeps inline <em> intact. Runs before any tween so the layout
     settles once, not twice. */
  function buildLines(el){
    if(el.dataset.built) return [].slice.call(el.querySelectorAll(".ln>span"));
    var parts=el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML=parts.map(function(part){
      return '<span class="ln"><span>'+part.trim()+"</span></span>";
    }).join("");
    el.dataset.built="1";
    return [].slice.call(el.querySelectorAll(".ln>span"));
  }

  /* ---------- motion ----------------------------------------------------
     THE RULE: every element's CSS default is its FINAL state. GSAP only sets
     a temporary from-state, with immediateRender:false on anything driven by
     a scroll trigger. If a trigger never fires, or GSAP never loads, or
     motion is reduced, the content is simply there. */
  function motion(){
    if(!(window.gsap&&window.ScrollTrigger)||reduce) return;
    gsap.registerPlugin(ScrollTrigger);

    var heroH1=document.querySelector(".hero h1");
    var heroLines=heroH1?buildLines(heroH1):[];

    var hero=gsap.timeline({defaults:{ease:"expo.out"}});
    if(heroLines.length) hero.fromTo(heroLines,{yPercent:110},{yPercent:0,duration:.95,stagger:.09},0);
    hero
        .fromTo(".hero-kicker",{opacity:0,y:10},{opacity:1,y:0,duration:.5},0)
        .fromTo(".hero-sub",{opacity:0,y:12},{opacity:1,y:0,duration:.55},.5)
        .fromTo(".hero-cta > *",{opacity:0,y:12},{opacity:1,y:0,duration:.55,stagger:.06},.6)
        .fromTo(".hero img.bg",{scale:1.14},{scale:1,duration:2.2},0);


    /* ---- the reveal vocabulary, lifted from Imperium ----
       data-lines     headline lines rise out of a mask
       data-reveal    fades and rises a touch  (="stagger" does its children)
       data-reveal=img fades in while the picture settles from a slight zoom
       data-parallax  drifts by that percent as you scroll past
       data-draw      a rule that draws left to right                       */
    document.querySelectorAll("[data-lines]").forEach(function(el){
      if(el.closest(".hero")) return;
      var lines=buildLines(el);
      gsap.fromTo(lines,{yPercent:110},{yPercent:0,duration:.9,ease:"expo.out",
        stagger:.07,immediateRender:false,
        scrollTrigger:{trigger:el,start:"top 88%",once:true}});
    });

    document.querySelectorAll("[data-reveal]").forEach(function(el){
      var kind=el.getAttribute("data-reveal");
      if(kind==="img"){
        gsap.fromTo(el,{opacity:0},{opacity:1,duration:.7,ease:"power2.out",
          immediateRender:false,scrollTrigger:{trigger:el,start:"top 88%",once:true}});
        var media=el.querySelector("img,video");
        if(media) gsap.fromTo(media,{scale:1.06},{scale:1,duration:1.1,ease:"expo.out",
          immediateRender:false,scrollTrigger:{trigger:el,start:"top 88%",once:true}});
        return;
      }
      var t=kind==="stagger"?el.children:el;
      gsap.fromTo(t,{opacity:0,y:14},{opacity:1,y:0,duration:.7,ease:"expo.out",
        stagger:.07,immediateRender:false,
        scrollTrigger:{trigger:el,start:"top 92%",once:true}});
    });

    document.querySelectorAll("[data-parallax]").forEach(function(el){
      gsap.to(el,{yPercent:Number(el.getAttribute("data-parallax")||-8),ease:"none",
        scrollTrigger:{trigger:el.parentElement||el,scrub:.6}});
    });

    document.querySelectorAll("[data-draw]").forEach(function(el){
      gsap.fromTo(el,{scaleX:0},{scaleX:1,transformOrigin:"left center",duration:1,
        ease:"power3.inOut",immediateRender:false,
        scrollTrigger:{trigger:el,start:"top 85%",once:true}});
    });

    gsap.to(".hero img.bg",{yPercent:12,ease:"none",
      scrollTrigger:{trigger:"#hero",start:"top top",end:"bottom top",scrub:true}});
    gsap.to(".enq .bgimg",{yPercent:-10,ease:"none",
      scrollTrigger:{trigger:"#enquire",start:"top bottom",end:"bottom top",scrub:true}});

    /* ---- THE APERTURE ---- the only pin on the page */
    var ap=$("aperture");
    if(ap){
      var narrow=window.matchMedia("(max-width:767px)").matches;
      gsap.fromTo(ap,
        {"--ap-y":43,"--ap-x":narrow?6:20,"--ap-frame":1},
        {"--ap-y":0,"--ap-x":0,"--ap-frame":0,ease:"none",immediateRender:false,
         scrollTrigger:{trigger:ap,start:"top top",end:narrow?"+=80%":"+=110%",
           pin:true,scrub:.6,anticipatePin:1,
           onToggle:function(st){
             var im=ap.querySelector("img");
             if(im) im.style.willChange=st.isActive?"clip-path":"";
           }}});
    }

    window.addEventListener("load",function(){ ScrollTrigger.refresh(); });
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });
  }
  if(document.readyState==="complete") motion();
  else window.addEventListener("load",motion);

  /* ---------- lightbox ---------- */
  (function(){
    var lb=$("lb"), img=$("lbImg"), cap=$("lbCap");
    var items=[].slice.call(document.querySelectorAll(".plate-item button")), idx=0;
    if(!items.length) return;
    function show(i){
      idx=(i+items.length)%items.length;
      var b=items[idx];
      img.src=b.getAttribute("data-src");
      img.alt=b.querySelector("img").alt;
      cap.textContent=b.getAttribute("data-cap");
    }
    items.forEach(function(b,i){
      b.setAttribute("tabindex","0"); b.setAttribute("role","button");
      b.addEventListener("click",function(){
        show(i);
        if(lb.showModal){ lb.showModal(); $("lbNext").focus(); }
        else window.open(b.getAttribute("data-src"),"_blank","noopener");
      });
      b.addEventListener("keydown",function(e){
        if(e.key==="Enter"||e.key===" "){ e.preventDefault(); b.click(); }
      });
    });
    if($("lbPrev")) $("lbPrev").addEventListener("click",function(){ show(idx-1) });
    if($("lbNext")) $("lbNext").addEventListener("click",function(){ show(idx+1) });
    if($("lbClose")) $("lbClose").addEventListener("click",function(){ lb.close() });
    lb.addEventListener("click",function(e){ if(e.target===lb) lb.close() });
    lb.addEventListener("keydown",function(e){
      if(e.key==="ArrowLeft") show(idx-1);
      if(e.key==="ArrowRight") show(idx+1);
    });
  })();

  /* ---------- enquiry form ----------
     Job type and timing come first; the contact details follow. Someone who
     has answered two dropdowns has already started. */
  (function(){
    var f=$("quoteForm");
    if(!f) return;
    var FORM=CFG.form||{};
    var OWNER=SITE.ownerFirstName||"us";

    function digits(v){ return (v.match(/\d/g)||[]).length }
    function val(id){ var el=$(id); return el?el.value.trim():"" }
    function setErr(el,errEl,bad){
      el.setAttribute("aria-invalid",bad?"true":"false");
      if(errEl) errEl.hidden=!bad;
    }
    var FIELDS=[
      ["qName","qNameErr",function(v){ return !!v.trim() }],
      ["qPhone","qPhoneErr",function(v){ return digits(v)>=8 }],
      ["qSuburb","qSuburbErr",function(v){ return !!v.trim() }]
    ];
    FIELDS.forEach(function(t){
      var el=$(t[0]);
      if(!el) return;
      el.addEventListener("input",function(){
        if(el.getAttribute("aria-invalid")==="true"&&t[2](el.value)) setErr(el,$(t[1]),false);
      });
    });

    f.addEventListener("submit",function(e){
      e.preventDefault();
      if($("qCompany")&&$("qCompany").value) return;      /* honeypot: silent no-op */

      var first=null;
      FIELDS.forEach(function(t){
        var el=$(t[0]);
        if(!el) return;
        var bad=!t[2](el.value);
        setErr(el,$(t[1]),bad);
        if(bad&&!first) first=el;
      });
      var err=$("formErr");
      if(first){ if(err) err.hidden=false; first.focus(); return; }
      if(err) err.hidden=true;

      var d={ name:val("qName"), phone:val("qPhone"), email:val("qEmail"),
              suburb:val("qSuburb"), service:val("qService"), when:val("qWhen"),
              message:val("qMsg") };
      var btn=$("qSend"), firstName=d.name.split(" ")[0];
      var text=["Hi "+OWNER+", enquiry from the website.",
        d.service?"Need: "+d.service:"", d.when?"When: "+d.when:"",
        "Suburb: "+d.suburb, "Name: "+d.name, "Mobile: "+d.phone,
        d.email?"Email: "+d.email:"", d.message?"Notes: "+d.message:""]
        .filter(Boolean).join("\n");

      function done(mode){
        var head=$("thanksHead"), body=$("thanksBody"), note=$("thanksNote"), sms=$("thanksSms");
        if(sms){ var h=smsHref(text); if(h) sms.href=h; }
        if(head) head.textContent = mode==="error"
          ? (FORM.errorHeading||"That did not send.")
          : "Thank you, "+firstName+".";
        if(body) body.textContent =
          mode==="sent" ? tmpl(FORM.successBody,{owner:OWNER,phone:d.phone})
          : mode==="demo" ? (FORM.demoBody||"Your enquiry has been received.")
          : tmpl(FORM.errorBody,{owner:OWNER,phone:SITE.phoneDisplay});
        if(note){
          note.hidden = mode!=="demo";
          if(mode==="demo") note.textContent=tmpl((CFG.demo||{}).formNote,{owner:OWNER});
        }
        if($("thanksSmsWrap")) $("thanksSmsWrap").hidden=(mode==="demo");
        f.hidden=true;
        var thanks=$("thanks");
        if(thanks){
          thanks.hidden=false;
          thanks.scrollIntoView({block:"center",behavior:reduce?"auto":"smooth"});
        }
        track("generate_lead",{method:mode==="sent"?"form":mode,service:d.service});
      }

      /* No key: validate, show the real success state, say plainly that nothing
         was sent, and make no network call at all. */
      if(!SITE.formAccessKey){ done("demo"); return; }

      if(btn){ btn.disabled=true; btn.setAttribute("aria-busy","true"); btn.textContent=FORM.sendingLabel||"Sending…"; }
      /* A dead network otherwise leaves the button on "Sending…" for ever. */
      var giveUp=new AbortController();
      var timer=setTimeout(function(){ giveUp.abort() },12000);

      fetch(SITE.formEndpoint,{method:"POST",
        headers:{"Content-Type":"application/json",Accept:"application/json"},
        body:JSON.stringify({access_key:SITE.formAccessKey,
          subject:"Enquiry: "+(d.service||"website")+" in "+d.suburb,
          from_name:(SITE.name||"")+" website",
          replyto:d.email||undefined,
          name:d.name,phone:d.phone,email:d.email,suburb:d.suburb,
          service:d.service,when:d.when,message:text}),
        signal:giveUp.signal})
      .then(function(r){
        /* Web3Forms answers 200 with {success:false} for a rejected send, so the
           status code on its own is not enough to call it delivered. */
        return r.json().catch(function(){return{}}).then(function(b){
          if(!r.ok||b.success===false) throw new Error(b.message||("HTTP "+r.status));
        });
      })
      .then(function(){ done("sent") })
      .catch(function(){
        if(btn){ btn.disabled=false; btn.removeAttribute("aria-busy"); btn.textContent=FORM.submitLabel||"Send enquiry"; }
        done("error");
      })
      .then(function(){ clearTimeout(timer) });
    });
  })();

  /* ---------- count-up stats ----------------------------------------------
     The final figure is already in the HTML. This only animates over the top of
     it, so with no JS, no GSAP or reduced motion the right number is on screen. */
  all("[data-count]").forEach(function(el){
    var raw=el.getAttribute("data-count"), target=parseFloat(raw);
    if(!isFinite(target)) return;                        /* never render "NaN" */
    var dec=(raw.split(".")[1]||"").length;
    var suffix=el.getAttribute("data-suffix")||"";
    function fmt(v){
      return v.toLocaleString("en-AU",{minimumFractionDigits:dec,maximumFractionDigits:dec})+suffix;
    }
    if(reduce||!("IntersectionObserver" in window)){ el.textContent=fmt(target); return; }
    var io=new IntersectionObserver(function(entries){
      if(!entries[0].isIntersecting) return;
      io.disconnect();
      var start=null;
      (function step(now){
        if(start===null) start=now;
        var t=Math.min(1,(now-start)/1600);
        el.textContent=fmt(target*(1-Math.pow(1-t,3)));  /* power3.out */
        if(t<1) requestAnimationFrame(step); else el.textContent=fmt(target);
      })(performance.now());
    },{rootMargin:"0px 0px -10% 0px"});
    io.observe(el);
  });
})();
