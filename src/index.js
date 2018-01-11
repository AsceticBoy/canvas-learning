import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import * as D3 from 'd3'
import elementResize from 'element-resize-event'
import Json from './mock.js'
import './index.less'

const BOARD_HEIGHT = Math.max(document.body.clientHeight, document.documentElement.clientHeight)
const BOARD_WIDTH = Math.min(document.body.clientWidth, document.documentElement.clientWidth)

const CARD_HEIGHT = 150 
const CARD_WIDTH = 200
const CARD_OFFSET = 50

const severityToColor = {
  '0': 'recovery', // 恢复
  '1': 'warning', // 提醒
  '2': 'error', // 警告
  '3': 'critical'  // 紧急
}

String.prototype.toNumber = function() { return Number(this) }

const active = {} // 活动对象
let impactDistance = 0

class DragBoard extends Component {

  static propTypes = {
    width: PropTypes.number,
    height: PropTypes.number,
    dataSource: PropTypes.array.isRequired
  }

  constructor(props) {
    super(props)
    this.renderCard = this.renderCard.bind(this)
    this.impact = this.impact.bind(this)
    this.state = {
      dataSource: props.dataSource || []
    }
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.dataSource !== this.props.dataSource) {
      this.setState({
        dataSource: nextProps.dataSource
      })
    }
  }

  componentDidMount() {
    this.renderCard()
  }

  componentDidUpdate() {
    this.renderCard()
  }

  computeRectXY(board, rect, index) {
    // 先计算每行到底能放几个
    const rowcount = Math.floor((board.width - CARD_OFFSET) / (rect.width + CARD_OFFSET))
    const quotient = Math.floor(index / rowcount)
    const remainder = Math.floor(index % rowcount)

    return {
      x: (remainder + 1) * CARD_OFFSET + remainder * rect.width,
      y: (quotient + 1) * CARD_OFFSET + quotient * rect.height,
    }
  }

  renderCard() {
    const boardHeight = this.props.height || BOARD_HEIGHT
    const boardWidth = this.props.width || BOARD_WIDTH
    const dataSource = this.state.dataSource || []
    
    this.board = D3.select('#dragBoard')
      .append('svg:svg')
      .attr('height', boardHeight)
      .attr('width', boardWidth)

    let cards = this.board.selectAll('g.drag-board-card')
      .data(dataSource)

    cards.enter()
      .append('g:g')
      .attr('class', 'drag-board-card')
      .append('rect')
      .attr('x', (d, i) => {
        return (
          this.computeRectXY(
            { width: boardWidth, height: boardHeight },
            { width: CARD_WIDTH, height: CARD_HEIGHT },
            i
          ).x
        )
      })
      .attr('y', (d, i) => {
        return (
          this.computeRectXY(
            { width: boardWidth, height: boardHeight },
            { width: CARD_WIDTH, height: CARD_HEIGHT },
            i
          ).y
        )
      })
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('class', d => severityToColor[d.severity])
      .attr('height', CARD_HEIGHT)
      .attr('width', CARD_WIDTH)
      .style('opacity', '0')
      .transition()
      .duration(2000)
      .style('opacity', '1')
    // 移除空白的
    cards.exit().remove()
    
    // 绑定拖动事件
    D3.selectAll('.drag-board-card')
      .call(this.dragCard())
  }

  // 元素碰撞，如果是相撞了返回x,y 否则返回false
  impact(node, offsetX, offsetY) {
    // 方块A原始位置 + 鼠标偏移量
    const nodeAWidth = active.width
    const nodeAHeight = active.height
    const nodeALeft = active.x + offsetX
    const nodeATop = active.y + offsetY
    // 方块B
    const nodeBWidth = D3.select(node).attr('width').toNumber()
    const nodeBHeight = D3.select(node).attr('height').toNumber()
    const nodeBLeft = D3.select(node).attr('x').toNumber()
    const nodeBTop = D3.select(node).attr('y').toNumber()
    if (
      (nodeAWidth + nodeALeft) < nodeBLeft ||
      (nodeAHeight + nodeATop) < nodeBTop ||
      (nodeBWidth + nodeBLeft) < nodeALeft ||
      (nodeBHeight + nodeBTop) < nodeATop
    ) {
      return false
    }
    return {
      x: nodeBLeft,
      y: nodeBTop
    }
  }

  // 利用勾股定理算出碰撞直线距离
  distance(x, y, offsetX, offsetY) {
    let a = active.x + offsetX - x
    let b = active.y + offsetY - y
    return Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))
  }

  // 检测碰撞
  detect(selection, offsetX, offsetY) {
    D3.event.sourceEvent.stopPropagation()
    D3.selectAll('g.drag-board-card')
      .call((allNodesSelection) => {
        for (let node of allNodesSelection.selectAll('rect').filter(d => d.id !== active.nodeData.id).nodes()) {
          let nodeXY = this.impact(node, offsetX, offsetY) 
          // 碰撞到了
          if (nodeXY) {
            let distance = this.distance(nodeXY.x, nodeXY.y, offsetX, offsetY) // 有可能有碰到多个的情况
            if (impactDistance) {
              if (impactDistance > distance) {
                console.log(node)
              }
            } else {
              impactDistance = distance
            }
          }
        }
      })
  }

  dragCard() {
    let _this = this
    return D3.drag()
      .on('start', function (d) {
        // 1.确定初始的鼠标位置，后面移动需要依据这个来transform
        D3.event.sourceEvent.stopPropagation()
        active.mouseToX = D3.event.x
        active.mouseToY = D3.event.y
        active.width = D3.select(this).select('rect').attr('width').toNumber()
        active.height = D3.select(this).select('rect').attr('height').toNumber()
        active.x = D3.select(this).select('rect').attr('x').toNumber()
        active.y = D3.select(this).select('rect').attr('y').toNumber()
        active.nodeData = d
      })
      .on('drag', function () {
        // 1.利用transform实现拖动
        // 2.碰撞检测
        D3.event.sourceEvent.stopPropagation()
        
        let translateX = D3.event.x - active.mouseToX
        let translateY = D3.event.y - active.mouseToY
    
        D3.select(this)
          .attr("transform", "translate(" + translateX + ", " + translateY + ")")
          .call(function (selection) {
            _this.detect(selection, translateX, translateY)
          })
      })
      .on('end', function (d) {
        // 1.生成新的x,y,移除tranform
        D3.event.sourceEvent.stopPropagation()
        D3.select(this)
        .attr("transform", null)
        .select('rect')
        .attr('x', function () {
          return active.x + D3.event.x - active.mouseToX
        })
        .attr('y', function () {
          return active.y + D3.event.y - active.mouseToY
        })
      })
  }

  render() {
    return (
      <div id="dragBoard" className='drag-board'></div>
    )
  }
}

const app = document.body.querySelector('#app')

ReactDOM.render(
  <DragBoard 
    width={1000}
    height={800}
    dataSource={Json}
    dragEnd={() => {}}
  />,
app)